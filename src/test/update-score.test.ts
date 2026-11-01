import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/* ────────────────────────────────────────────────────────────────────────────
   H3 regression: the final score used to be dropped silently.

   `updateScore` returned early whenever `currentPlayer` had not loaded yet, so a
   slow join or a changed anon user id meant the result was never written — and
   nobody was told. These tests pin the two things that fix depends on:
     1. it recovers the row from session_id + user_id instead of giving up;
     2. it reports the outcome as a boolean so the caller can warn the player.
   ──────────────────────────────────────────────────────────────────────────── */

const state = vi.hoisted(() => ({
  playerRowId: "player-1" as string | null,
  writeError: null as { message: string } | null,
  updatePayloads: [] as Record<string, unknown>[],
  updateFilters: [] as { column: string; value: unknown }[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    let selectArg = "";
    let isUpdate = false;

    const resolve = () => {
      if (table === "game_sessions") {
        return { data: { id: "s1", status: "playing", difficulty: "easy" }, error: null };
      }
      if (table === "game_players") {
        if (isUpdate) return { data: null, error: state.writeError };
        if (selectArg === "id") {
          return {
            data: state.playerRowId ? [{ id: state.playerRowId }] : [],
            error: null,
          };
        }
        /* The list query returns nobody, which is what leaves `currentPlayer`
           null and forces the session+user recovery path. */
        return { data: [], error: null };
      }
      return { data: null, error: null };
    };

    const b: Record<string, unknown> = {
      select: (arg?: string) => {
        selectArg = arg ?? "";
        return b;
      },
      order: () => b,
      limit: () => b,
      eq: (column: string, value: unknown) => {
        if (isUpdate) state.updateFilters.push({ column, value });
        return b;
      },
      update: (payload: Record<string, unknown>) => {
        isUpdate = true;
        state.updatePayloads.push(payload);
        return b;
      },
      single: () => Promise.resolve(resolve()),
      maybeSingle: () => Promise.resolve(resolve()),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
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
      from: (table: string) => builder(table),
      channel,
      removeChannel: vi.fn(),
    },
  };
});

async function mountHook() {
  const { useGameSession } = await import("@/hooks/useGameSession");
  let hook!: ReturnType<typeof renderHook<ReturnType<typeof useGameSession>, unknown>>;
  await act(async () => {
    hook = renderHook(() => useGameSession("s1", "u1"));
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  state.playerRowId = "player-1";
  state.writeError = null;
  state.updatePayloads = [];
  state.updateFilters = [];
});

describe("useGameSession.updateScore", () => {
  it("recovers the player row from session + user when currentPlayer is null", async () => {
    const hook = await mountHook();
    expect(hook.result.current.currentPlayer).toBeNull();

    let saved = false;
    await act(async () => {
      saved = await hook.result.current.updateScore(500, 2, 42_000, true);
    });

    expect(saved).toBe(true);
    expect(state.updatePayloads).toHaveLength(1);
    expect(state.updatePayloads[0]).toMatchObject({
      score: 500,
      incorrect_attempts: 2,
      elapsed_time_ms: 42_000,
      completed: true,
    });
  });

  it("returns false when no player row can be found", async () => {
    state.playerRowId = null;
    const hook = await mountHook();

    let saved = true;
    await act(async () => {
      saved = await hook.result.current.updateScore(500, 0, 1_000, true);
    });

    expect(saved).toBe(false);
    expect(state.updatePayloads).toHaveLength(0);
  });

  it("returns false and surfaces the error when the write fails", async () => {
    state.writeError = { message: "permission denied" };
    const hook = await mountHook();

    let saved = true;
    await act(async () => {
      saved = await hook.result.current.updateScore(500, 0, 1_000, true);
    });

    expect(saved).toBe(false);
    expect(hook.result.current.error).toBe("permission denied");
  });

  /* H1: a timeout must not be able to overwrite a run that already finished. */
  it("only writes an incomplete result to rows that are still incomplete", async () => {
    const hook = await mountHook();

    await act(async () => {
      await hook.result.current.updateScore(120, 3, 90_000, false);
    });

    expect(state.updatePayloads[0]).toMatchObject({ completed: false, completed_at: null });
    expect(state.updateFilters).toContainEqual({ column: "completed", value: false });
  });

  it("does not filter on completed when the run really finished", async () => {
    const hook = await mountHook();

    await act(async () => {
      await hook.result.current.updateScore(900, 0, 30_000, true);
    });

    expect(state.updateFilters.some((f) => f.column === "completed")).toBe(false);
  });

  it("clamps a negative elapsed time to zero before writing", async () => {
    const hook = await mountHook();

    await act(async () => {
      await hook.result.current.updateScore(100, 0, -5_000, true);
    });

    expect(state.updatePayloads[0]).toMatchObject({ elapsed_time_ms: 0 });
  });
});
