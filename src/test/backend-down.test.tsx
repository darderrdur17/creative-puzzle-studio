import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";

/* ────────────────────────────────────────────────────────────────────────────
   Backend-unreachable behaviour on the landing page.

   When the anonymous guest session fails, `userId` stays null. That made
   `useBestIdeasAnswer` settle on "no saved answer" — identical to a first-time
   visitor — so the page rendered the best-ideas form and disabled
   `Join a Game`, with nothing on screen explaining why. A student could type a
   whole answer, press Continue, get "Still connecting…" forever, and have no
   way to tell a broken app from a slow one.

   These tests pin the contract: an unreachable backend must be *named*, the
   dead-end form must not be shown, and the healthy path must be unchanged.
   ──────────────────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  auth: {
    userId: null as string | null,
    loading: false,
    authError: null as string | null,
  },
  retryAuth: vi.fn(),
}));

vi.mock("@/hooks/useAnonymousAuth", () => ({
  useAnonymousAuth: () => ({
    userId: mocks.auth.userId,
    loading: mocks.auth.loading,
    authError: mocks.auth.authError,
    retryAuth: mocks.retryAuth,
    ensureGuestSession: vi.fn(async () => mocks.auth.userId),
  }),
}));

vi.mock("@/hooks/useTeacherAuth", () => ({
  useTeacherAuth: () => ({
    user: null,
    loading: false,
    displayName: null,
    isTeacher: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGameSession", () => ({
  useGameSession: () => ({
    createSession: vi.fn(async () => null),
    joinSession: vi.fn(async () => null),
    error: null,
    setError: vi.fn(),
  }),
}));

async function renderHome(initialEntry = "/") {
  const { default: Index } = await import("@/pages/Index");
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Index />
        </MemoryRouter>
      </ThemeProvider>,
    );
  });
  return result;
}

beforeEach(() => {
  mocks.auth.userId = null;
  mocks.auth.loading = false;
  mocks.auth.authError = null;
  mocks.retryAuth.mockClear();
});

describe("landing page with an unreachable backend", () => {
  it("names the failure instead of silently disabling Join a Game", async () => {
    mocks.auth.authError = "Failed to fetch";
    await renderHome();

    expect(await screen.findByText(/can.t reach the game server/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("does not show the best-ideas form, which can never be saved", async () => {
    mocks.auth.authError = "Failed to fetch";
    await renderHome();

    await screen.findByText(/can.t reach the game server/i);
    // The form is the dead end: it accepts text and then fails to save forever.
    expect(screen.queryByLabelText(/Where do you get your best ideas/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Continue$/i })).not.toBeInTheDocument();
  });

  it("keeps Join a Game disabled — there is no session to join with", async () => {
    mocks.auth.authError = "Failed to fetch";
    await renderHome();

    const join = await screen.findByRole("button", { name: /Join a Game/i });
    expect(join).toBeDisabled();
  });

  it("still reaches the teacher login and the lab without a backend", async () => {
    mocks.auth.authError = "Failed to fetch";
    await renderHome();

    expect(await screen.findByRole("button", { name: /Teacher Login/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /8.Puzzle Lab/i })).toBeEnabled();
  });

  it("explains the failure on a code deep link instead of dead-ending", async () => {
    mocks.auth.authError = "Failed to fetch";
    await renderHome("/?code=ABC123");

    expect(await screen.findByText(/can.t reach the game server/i)).toBeInTheDocument();
  });
});

describe("landing page with a working backend", () => {
  it("asks the best-ideas question and offers the retry-free path", async () => {
    mocks.auth.userId = "user-1";
    await renderHome();

    // The question appears twice (card title + sr-only label), so target the heading.
    expect(
      await screen.findByRole("heading", { name: /Where do you get your best ideas/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/can.t reach the game server/i)).not.toBeInTheDocument();
    // Answering first is the designed gate, not a failure state.
    expect(screen.getByRole("button", { name: /Join a Game/i })).toBeDisabled();
  });
});
