import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JigsawImagePuzzle } from "@/components/game/JigsawImagePuzzle";
import { getRandomizedStages, type CreativityStage } from "@/lib/gameData";

/**
 * End-to-end playthrough of the real board.
 *
 * Every other test in this suite exercises a pure function or a page's error
 * path; none of them ever put a piece on the board. That left the largest
 * piece of actual gameplay — key placement, the two-phase transition, quote
 * matching, wrong-tap rejection and completion — verified only by eye. This
 * drives the component the way a player does, through the DOM, and asserts the
 * callbacks the scoring layer depends on.
 *
 * Three jsdom quirks shape the harness:
 *
 *  - A placed cell keeps its DOM node but its `aria-label` changes from
 *    "Key slot 1" to "Placed: <statement>", so any list built by label drifts
 *    the moment something is placed. Cells are captured by reference once.
 *  - The tray removes placed pieces through a Framer Motion exit animation,
 *    which never completes under jsdom, so a placed piece's button lingers in
 *    the tree. "Has this piece been placed?" is therefore answered by the
 *    cell's label, never by the piece's absence from the tray.
 *  - Phase 1's tray only lists key pieces, so decoys do not exist in the DOM
 *    until the key row is complete.
 */

type Cell = HTMLButtonElement;

const COLS = 4;

const labelOf = (el: Element) => el.getAttribute("aria-label") ?? "";

/** A cell is filled once the component swaps its label to "Placed: …". */
const isPlaced = (cell: Cell) => labelOf(cell).startsWith("Placed:");

const trayPiece = (label: string) => screen.queryByRole("button", { name: label }) as Cell | null;

/** Tap a tray piece so it is selected (selection toggles, so check first). */
function select(label: string): boolean {
  const piece = trayPiece(label);
  if (!piece) return false;
  if (piece.getAttribute("aria-pressed") !== "true") fireEvent.click(piece);
  return true;
}

const keyCells = () =>
  [0, 1, 2, 3].map((i) => screen.getByRole("button", { name: `Key slot ${i + 1}` }) as Cell);

/**
 * Clear the key row the way a player must: try each stage's key against each
 * column until one accepts it. Occupied cells report "blocked" rather than a
 * wrong tap, so this never inflates `onIncorrect`.
 */
function placeAllKeys(stages: CreativityStage[]): Map<string, number> {
  const cells = keyCells();
  const columnOfStage = new Map<string, number>();
  for (const stage of stages) {
    const label = `Key: ${stage.name}`;
    for (let col = 0; col < COLS; col++) {
      const cell = cells[col];
      if (cell.disabled || isPlaced(cell)) continue;
      if (!select(label)) break;
      fireEvent.click(cell);
      if (isPlaced(cell)) {
        columnOfStage.set(stage.id, col);
        break;
      }
    }
    expect(columnOfStage.get(stage.id), `key "${stage.name}" placed nowhere`).toBeDefined();
  }
  return columnOfStage;
}

/**
 * Wait out the 2.2 s key→quote transition and return the unlocked quote cells.
 * `expected` is `(rows - 1) * cols` for the difficulty under test — 8 on Easy
 * (4×3), 16 on Hard (4×5).
 */
async function awaitQuotePhase(expected: number): Promise<Cell[]> {
  await waitFor(
    () => {
      const unlocked = (
        screen.getAllByRole("button", { name: /^Quote slot \d$/ }) as Cell[]
      ).filter((c) => !c.disabled);
      expect(unlocked).toHaveLength(expected);
    },
    { timeout: 4000 },
  );
  return screen.getAllByRole("button", { name: /^Quote slot \d$/ }) as Cell[];
}

describe("JigsawImagePuzzle — full playthrough", () => {
  it(
    "places every key and every quote, rejects wrong taps, and completes once",
    async () => {
      const stages = getRandomizedStages();
      const onPiecePlaced = vi.fn();
      const onIncorrect = vi.fn();
      const onCompleted = vi.fn();
      const onPhaseComplete = vi.fn();

      render(
        <JigsawImagePuzzle
          difficulty="easy"
          stages={stages}
          onPiecePlaced={onPiecePlaced}
          onIncorrect={onIncorrect}
          onCompleted={onCompleted}
          onPhaseComplete={onPhaseComplete}
        />,
      );

      const placedLabels = new Set<string>();
      let wrongTaps = 0;

      /**
       * Mirrors a player: tap the piece in the tray, then tap a cell. Returns
       * what actually happened so the test asserts on the board's reaction
       * rather than on its internal state.
       */
      function attempt(label: string, cell: Cell): "placed" | "wrong" | "blocked" {
        if (placedLabels.has(label)) return "blocked";
        if (cell.disabled || isPlaced(cell)) return "blocked";
        if (!select(label)) return "blocked";
        fireEvent.click(cell);
        if (isPlaced(cell)) {
          placedLabels.add(label);
          return "placed";
        }
        wrongTaps += 1;
        return "wrong";
      }

      // ── Phase 1: main keys ──────────────────────────────────────────────
      const cells = keyCells();
      expect(cells).toHaveLength(4);

      const columnOfStage = placeAllKeys(stages);
      // Every column holds exactly one key.
      expect([...columnOfStage.values()].sort()).toEqual([0, 1, 2, 3]);
      expect(onPiecePlaced).toHaveBeenCalledTimes(4);
      expect(onPhaseComplete).toHaveBeenCalledTimes(1);

      // The board announces the phase change before switching over.
      expect(screen.getByText(/Main keys complete!/)).toBeInTheDocument();

      // ── Phase 2: quotes ────────────────────────────────────────────────
      const quoteCells = await awaitQuotePhase(8); // Easy 4×3 → 2 quote rows

      const byColumn = new Map<number, Cell[]>();
      for (const cell of quoteCells) {
        const col = Number(/^Quote slot (\d)$/.exec(labelOf(cell))![1]) - 1;
        byColumn.set(col, [...(byColumn.get(col) ?? []), cell]);
      }
      expect(byColumn.size).toBe(4);

      const freeCellIn = (col: number) =>
        (byColumn.get(col) ?? []).find((cell) => !isPlaced(cell)) ?? null;

      const quoteLabels = (
        screen.queryAllByRole("button", { name: /^Quote: / }) as Cell[]
      ).map(labelOf);
      expect(quoteLabels).toHaveLength(8);

      for (const label of quoteLabels) {
        const statement = label.replace(/^Quote: /, "");
        const stage = stages.find((s) => s.quotes.includes(statement));
        expect(stage, `quote not found in any stage: ${statement}`).toBeDefined();
        const target = columnOfStage.get(stage!.id)!;

        // Prove a wrong column is refused — and that refusing it leaves the
        // cell empty and the piece still available.
        const wrongCol = [0, 1, 2, 3].find((c) => c !== target && freeCellIn(c));
        if (wrongCol !== undefined) {
          const wrongCell = freeCellIn(wrongCol)!;
          expect(attempt(label, wrongCell), "quote accepted in the wrong column").toBe("wrong");
          expect(isPlaced(wrongCell)).toBe(false);
          expect(trayPiece(label)).not.toBeNull();
        }

        const targetCell = freeCellIn(target);
        expect(targetCell, `column ${target} had no free slot`).not.toBeNull();
        expect(attempt(label, targetCell!), "correct quote rejected").toBe("placed");
      }

      // ── Completion ─────────────────────────────────────────────────────
      expect(onPiecePlaced).toHaveBeenCalledTimes(12); // 4 keys + 8 quotes
      expect(onIncorrect).toHaveBeenCalledTimes(wrongTaps);
      expect(wrongTaps).toBeGreaterThan(0);

      // Every cell is filled: 4 key cells + 8 quote cells, no gaps.
      const allCells = [...cells, ...quoteCells];
      expect(allCells).toHaveLength(12);
      expect(allCells.filter(isPlaced)).toHaveLength(12);

      expect(screen.getByText("All pieces placed!")).toBeInTheDocument();
      expect(screen.getByText("0 left")).toBeInTheDocument();

      await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1), { timeout: 4000 });

      // Nothing should complete twice, even after the delayed callback resolves.
      // The wait is wrapped in act: Framer Motion's exit animations settle
      // during it, and letting them update outside act warns spuriously.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 900));
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);
    },
    20000,
  );

  it(
    "never lets a decoy piece onto the board",
    async () => {
      // Hard (level 3) adds `level - 1` = 2 decoy pieces. A decoy must be
      // refused everywhere — otherwise a player could fill the board with
      // wrong quotes and still "complete" it.
      const stages = getRandomizedStages();
      const onPiecePlaced = vi.fn();
      const onIncorrect = vi.fn();
      const onCompleted = vi.fn();

      render(
        <JigsawImagePuzzle
          difficulty="hard"
          stages={stages}
          onPiecePlaced={onPiecePlaced}
          onIncorrect={onIncorrect}
          onCompleted={onCompleted}
        />,
      );

      // Decoys live in the quote tray, so they only exist after the keys land.
      expect(screen.queryAllByRole("button", { name: /^Decoy: / })).toHaveLength(0);
      placeAllKeys(stages);
      const quoteCells = await awaitQuotePhase(16); // Hard 4×5 → 4 quote rows

      const decoys = screen.queryAllByRole("button", { name: /^Decoy: / }) as Cell[];
      expect(decoys).toHaveLength(2);

      // Clearing the key row legitimately places 4 pieces, so measure the
      // decoy phase as a delta rather than from zero.
      const placementsBefore = onPiecePlaced.mock.calls.length;
      const wrongsBefore = onIncorrect.mock.calls.length;
      expect(placementsBefore).toBe(4);

      for (const decoy of decoys) {
        const label = labelOf(decoy);
        for (const cell of quoteCells) {
          if (cell.disabled || isPlaced(cell)) continue;
          if (!select(label)) break;
          fireEvent.click(cell);
          expect(isPlaced(cell), "decoy accepted onto the board").toBe(false);
        }
      }

      // One rejection per free quote cell per decoy, and not a single placement.
      expect(onIncorrect.mock.calls.length - wrongsBefore).toBe(
        quoteCells.length * decoys.length,
      );
      expect(onPiecePlaced.mock.calls.length).toBe(placementsBefore);
      expect(onCompleted).not.toHaveBeenCalled();
    },
    20000,
  );
});
