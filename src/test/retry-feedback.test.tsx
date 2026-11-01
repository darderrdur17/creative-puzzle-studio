import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";

/* ────────────────────────────────────────────────────────────────────────────
   Retry-feedback tests.

   Both "Try again" buttons used to be indistinguishable from dead controls: the
   query failed again, the error text was byte-identical, and nothing told the
   user their click had done anything. The browser audit flagged them as
   NO_EFFECT for exactly that reason. These tests pin the contract:
   a manual retry that fails MUST report failure.
   ──────────────────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  fail: { current: true },
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/useAnonymousAuth", () => ({
  useAnonymousAuth: () => ({ userId: "user-1", loading: false, ensureGuestSession: vi.fn() }),
}));

vi.mock("@/hooks/useTeacherAuth", () => ({
  useTeacherAuth: () => ({
    user: null,
    loading: false,
    displayName: "Teacher",
    isTeacher: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = () =>
    mocks.fail.current
      ? { data: null, error: { message: "Failed to fetch" } }
      : { data: [], error: null };

  const builder = () => {
    /* A thenable builder: the real client is awaited directly after `.limit()`
       or `.order()`, so the mock must resolve like a promise too. */
    const b: Record<string, unknown> = {
      select: () => b,
      order: () => b,
      limit: () => b,
      eq: () => b,
      neq: () => b,
      update: () => b,
      insert: () => b,
      delete: () => b,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(onFulfilled, onRejected),
    };
    return b;
  };

  const channel = () => {
    const c: Record<string, unknown> = {
      on: () => c,
      subscribe: () => c,
      unsubscribe: () => c,
    };
    return c;
  };

  return {
    supabase: {
      from: () => builder(),
      channel,
      removeChannel: vi.fn(),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    },
  };
});

async function renderLeaderboard() {
  const { default: Leaderboard } = await import("@/pages/Leaderboard");
  /* The initial fetch resolves on a microtask, so it must be flushed inside
     `act` or React warns about an update outside the test's scope. */
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ThemeProvider>
        <MemoryRouter
          initialEntries={["/leaderboard"]}
        >
          <Leaderboard />
        </MemoryRouter>
      </ThemeProvider>
    );
  });
  return result;
}

async function renderDashboard() {
  const { default: TeacherDashboard } = await import("@/pages/TeacherDashboard");
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ThemeProvider>
        <MemoryRouter
          initialEntries={["/dashboard/session-1"]}
        >
          <Routes>
            <Route path="/dashboard/:sessionId" element={<TeacherDashboard />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );
  });
  return result;
}

beforeEach(() => {
  mocks.fail.current = true;
  mocks.toastError.mockClear();
});

describe("Leaderboard retry", () => {
  it("shows a real error state instead of an empty board", async () => {
    await renderLeaderboard();
    expect(await screen.findByText(/Couldn't load the leaderboard/i)).toBeInTheDocument();
    // The old bug rendered "No games played yet" for a failed query.
    expect(screen.queryByText(/No games played yet/i)).not.toBeInTheDocument();
  });

  it("toasts when a manual retry fails again", async () => {
    await renderLeaderboard();

    const retry = await screen.findByRole("button", { name: /Try again/i });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Still can't load the leaderboard/i)
      );
    });
    // Let the retry's loading → error transition finish so the assertion below
    // (and the next test) never races a pending state update.
    await waitFor(() =>
      expect(screen.getByText(/Couldn't load the leaderboard/i)).toBeInTheDocument()
    );
  });

  it("does not toast on the automatic first load", async () => {
    await renderLeaderboard();
    await screen.findByText(/Couldn't load the leaderboard/i);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});

describe("Teacher dashboard retry", () => {
  it("shows a real error branch with a way out", async () => {
    await renderDashboard();
    expect(await screen.findByText(/Session not available/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to Home/i })).toBeInTheDocument();
  });

  it("toasts when a manual retry fails again", async () => {
    await renderDashboard();

    const retry = await screen.findByRole("button", { name: /Try again/i });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Still can't reach the server/i)
      );
    });
    // The retry flips loading on and back off; wait for the error branch to
    // return so the test ends with no pending update.
    await waitFor(() =>
      expect(screen.getByText(/Session not available/i)).toBeInTheDocument()
    );
  });
});
