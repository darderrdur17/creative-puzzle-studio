import React, { useEffect, useMemo, useState } from "react";
import puzzleBgImg from "@/assets/elephant-jewel-forest.png";

type GridSize = 3 | 4;

interface Tile {
  /** Index in solved order (0..N-1) */
  id: number;
  /** Current index in the flattened grid */
  position: number;
  /** Optional text label overlayed on this tile */
  text?: string;
}

interface SlidingPicturePuzzleProps {
  /** Grid dimension (3 => 3x3, 4 => 4x4). */
  size?: GridSize;
  /**
   * Optional text overlays for tiles in solved order.
   * If shorter than tile count, remaining tiles will have no text.
   */
  labels?: string[];
  /** Called when the puzzle is solved. */
  onSolved?: () => void;
}

function isSolvable(positions: number[], size: GridSize): boolean {
  // Standard sliding puzzle solvability check
  const N = positions.length;
  const blankIndex = positions.indexOf(N - 1);

  const inversions = positions
    .filter((v) => v !== N - 1)
    .reduce((acc, v, idx, arr) => {
      for (let j = idx + 1; j < arr.length; j++) {
        if (arr[j] !== N - 1 && arr[j] < v) acc++;
      }
      return acc;
    }, 0);

  if (size % 2 === 1) {
    // Odd grid: solvable when inversions even
    return inversions % 2 === 0;
  }

  // Even grid: row counting from bottom (1-based)
  const rowFromTop = Math.floor(blankIndex / size);
  const rowFromBottom = size - rowFromTop;
  if (rowFromBottom % 2 === 0) {
    // Blank on even row from bottom -> inversions must be odd
    return inversions % 2 === 1;
  }
  // Blank on odd row from bottom -> inversions must be even
  return inversions % 2 === 0;
}

function createShuffledTiles(size: GridSize, labels: string[] | undefined): Tile[] {
  const total = size * size;
  const solvedPositions = Array.from({ length: total }, (_, i) => i);

  // Start from solved and perform random valid moves with the blank.
  // This guarantees solvability and mimics the "random valid moves" approach.
  let state = [...solvedPositions];
  const blankValue = total - 1;

  const movesCount = 120;
  for (let m = 0; m < movesCount; m++) {
    const blankIndex = state.indexOf(blankValue);
    const row = Math.floor(blankIndex / size);
    const col = blankIndex % size;

    const neighbors: number[] = [];
    if (row > 0) neighbors.push(blankIndex - size);
    if (row < size - 1) neighbors.push(blankIndex + size);
    if (col > 0) neighbors.push(blankIndex - 1);
    if (col < size - 1) neighbors.push(blankIndex + 1);

    const target = neighbors[Math.floor(Math.random() * neighbors.length)];
    [state[blankIndex], state[target]] = [state[target], state[blankIndex]];
  }

  // Safety check: ensure solvable (should always be true with this algorithm)
  if (!isSolvable(state, size)) {
    state = solvedPositions;
  }

  return state.map((originalId, position) => ({
    id: originalId,
    position,
    text: labels?.[originalId],
  }));
}

export const SlidingPicturePuzzle: React.FC<SlidingPicturePuzzleProps> = ({
  size = 4,
  labels,
  onSolved,
}) => {
  const [tiles, setTiles] = useState<Tile[]>(() => createShuffledTiles(size, labels ?? []));

  const total = size * size;
  const blankId = total - 1;

  const isSolved = useMemo(
    () => tiles.every((t) => t.id === t.position),
    [tiles]
  );

  useEffect(() => {
    if (isSolved && onSolved) {
      onSolved();
    }
  }, [isSolved, onSolved]);

  const handleTileClick = (clickedIndex: number) => {
    const blankTile = tiles.find((t) => t.id === blankId);
    if (!blankTile) return;

    const blankPos = blankTile.position;
    const rowBlank = Math.floor(blankPos / size);
    const colBlank = blankPos % size;

    const rowClicked = Math.floor(clickedIndex / size);
    const colClicked = clickedIndex % size;

    const isAdjacent =
      (rowBlank === rowClicked && Math.abs(colBlank - colClicked) === 1) ||
      (colBlank === colClicked && Math.abs(rowBlank - rowClicked) === 1);

    if (!isAdjacent) return;

    // Swap clicked tile with blank
    setTiles((prev) =>
      prev.map((t) => {
        if (t.position === clickedIndex) {
          return { ...t, position: blankPos };
        }
        if (t.position === blankPos) {
          return { ...t, position: clickedIndex };
        }
        return t;
      })
    );
  };

  const tileSizePercent = 100 / size;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="text-lg">🧩</span>
          Sliding Picture Puzzle
        </h2>
        <button
          type="button"
          onClick={() => setTiles(createShuffledTiles(size, labels ?? []))}
          className="text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-accent/10 transition-colors"
        >
          Shuffle
        </button>
      </div>

      <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-border bg-black/5">
        {/* Background image is applied via tiles; this wrapper just holds the grid */}
        {tiles.map((tile) => {
          if (tile.id === blankId) {
            // Blank space
            return (
              <button
                key={tile.id}
                type="button"
                aria-label="Empty slot"
                style={{
                  position: "absolute",
                  width: `${tileSizePercent}%`,
                  height: `${tileSizePercent}%`,
                  top: `${Math.floor(tile.position / size) * tileSizePercent}%`,
                  left: `${(tile.position % size) * tileSizePercent}%`,
                }}
                className="bg-transparent"
              />
            );
          }

          const srcCol = tile.id % size;
          const srcRow = Math.floor(tile.id / size);

          const backgroundPosition = `${(srcCol * 100) / (size - 1)}% ${(srcRow * 100) / (size - 1)}%`;

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTileClick(tile.position)}
              style={{
                position: "absolute",
                width: `${tileSizePercent}%`,
                height: `${tileSizePercent}%`,
                top: `${Math.floor(tile.position / size) * tileSizePercent}%`,
                left: `${(tile.position % size) * tileSizePercent}%`,
                backgroundImage: `url(${puzzleBgImg})`,
                backgroundSize: `${size * 100}% ${size * 100}%`,
                backgroundPosition,
              }}
              className="group relative border border-white/20 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* Dark overlay for contrast */}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />

              {/* Optional text overlay */}
              {tile.text && (
                <div className="relative z-10 flex h-full w-full items-center justify-center px-1 text-center">
                  <span className="text-[10px] sm:text-xs font-semibold text-white drop-shadow-md">
                    {tile.text}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        {isSolved && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <div className="bg-white/95 rounded-xl px-4 py-3 shadow-lg text-center">
              <div className="text-2xl mb-1">🎉</div>
              <p className="font-display text-sm font-bold">Picture Complete!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

