import React, { useMemo, useState } from "react";
import elephantImg from "@/assets/elephant-jewel-forest.png";

interface Tile {
  /** Index in solved order (0..8) */
  id: number;
  /** Current index in flattened 3x3 grid */
  position: number;
}

const GRID_SIZE = 3;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const BLANK_ID = TOTAL_TILES - 1; // bottom-right blank

function createSolvedTiles(): Tile[] {
  return Array.from({ length: TOTAL_TILES }, (_, id) => ({
    id,
    position: id,
  }));
}

function getNeighbors(pos: number): number[] {
  const row = Math.floor(pos / GRID_SIZE);
  const col = pos % GRID_SIZE;
  const neighbors: number[] = [];
  if (row > 0) neighbors.push(pos - GRID_SIZE);
  if (row < GRID_SIZE - 1) neighbors.push(pos + GRID_SIZE);
  if (col > 0) neighbors.push(pos - 1);
  if (col < GRID_SIZE - 1) neighbors.push(pos + 1);
  return neighbors;
}

function performRandomMoves(tiles: Tile[], steps: number): Tile[] {
  let state = [...tiles];
  let lastBlankPos: number | null = null;

  for (let i = 0; i < steps; i++) {
    const blank = state.find((t) => t.id === BLANK_ID);
    if (!blank) break;
    const blankPos = blank.position;

    let candidates = getNeighbors(blankPos);
    if (lastBlankPos != null) {
      // optional: avoid immediately undoing the last move
      candidates = candidates.filter((pos) => pos !== lastBlankPos);
      if (candidates.length === 0) {
        candidates = getNeighbors(blankPos);
      }
    }

    const targetPos = candidates[Math.floor(Math.random() * candidates.length)];
    // Swap tile at targetPos with blank
    state = state.map((t) => {
      if (t.position === targetPos) return { ...t, position: blankPos };
      if (t.position === blankPos) return { ...t, position: targetPos };
      return t;
    });

    lastBlankPos = blankPos;
  }

  return state;
}

export const EightPuzzleLab: React.FC = () => {
  const [tiles, setTiles] = useState<Tile[]>(() => createSolvedTiles());
  const [loaded, setLoaded] = useState(false);
  const [bgColor, setBgColor] = useState("white");
  const [shuffleSteps, setShuffleSteps] = useState("1");

  const isSolved = useMemo(
    () => tiles.every((t) => t.id === t.position),
    [tiles]
  );

  const handleLoadPuzzle = () => {
    setTiles(createSolvedTiles());
    setLoaded(true);
  };

  const handleTileClick = (clickedPos: number) => {
    if (!loaded) return;
    const blank = tiles.find((t) => t.id === BLANK_ID);
    if (!blank) return;
    const blankPos = blank.position;

    const neighbors = getNeighbors(blankPos);
    const isAdjacent = neighbors.includes(clickedPos);
    if (!isAdjacent) {
      window.alert("Illegal move – you can only move tiles next to the empty space.");
      return;
    }

    setTiles((prev) =>
      prev.map((t) => {
        if (t.position === clickedPos) return { ...t, position: blankPos };
        if (t.position === blankPos) return { ...t, position: clickedPos };
        return t;
      })
    );
  };

  const handleShuffle = () => {
    const steps = Number(shuffleSteps);
    if (!Number.isInteger(steps) || steps < 1 || steps > 20) {
      window.alert("Please enter a shuffle step count between 1 and 20.");
      return;
    }

    setTiles((prev) => performRandomMoves(prev, steps));
  };

  const tileSizePercent = 100 / GRID_SIZE;

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <h1 className="font-display text-xl font-bold mb-4">Game Time! – 8‑Puzzle (Elephant Edition)</h1>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Puzzle grid */}
        <div className="flex-1">
          <p className="font-semibold mb-2">The puzzle:</p>
          <div
            className="relative aspect-[4/3] max-w-lg border border-gray-300 mx-auto"
            style={{ backgroundColor: bgColor }}
          >
            {tiles.map((tile) => {
              const row = Math.floor(tile.position / GRID_SIZE);
              const col = tile.position % GRID_SIZE;

              if (!loaded) {
                // Initial state: show simple placeholder monkeys 🐒
                return (
                  <div
                    key={tile.id}
                    style={{
                      position: "absolute",
                      width: `${tileSizePercent}%`,
                      height: `${tileSizePercent}%`,
                      top: `${row * tileSizePercent}%`,
                      left: `${col * tileSizePercent}%`,
                    }}
                    className="flex items-center justify-center text-4xl"
                  >
                    🐒
                  </div>
                );
              }

              if (tile.id === BLANK_ID) {
                return (
                  <button
                    key={tile.id}
                    type="button"
                    aria-label="Empty slot"
                    style={{
                      position: "absolute",
                      width: `${tileSizePercent}%`,
                      height: `${tileSizePercent}%`,
                      top: `${row * tileSizePercent}%`,
                      left: `${col * tileSizePercent}%`,
                    }}
                    className="bg-transparent"
                  />
                );
              }

              const srcCol = tile.id % GRID_SIZE;
              const srcRow = Math.floor(tile.id / GRID_SIZE);
              const backgroundPosition = `${(srcCol * 100) / (GRID_SIZE - 1)}% ${
                (srcRow * 100) / (GRID_SIZE - 1)
              }%`;

              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTileClick(tile.position)}
                  style={{
                    position: "absolute",
                    width: `${tileSizePercent}%`,
                    height: `${tileSizePercent}%`,
                    top: `${row * tileSizePercent}%`,
                    left: `${col * tileSizePercent}%`,
                    backgroundImage: `url(${elephantImg})`,
                    backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
                    backgroundPosition,
                  }}
                  className="border border-white/80 shadow-sm hover:brightness-110 transition"
                />
              );
            })}

            {loaded && isSolved && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl px-4 py-2 shadow">
                  <span className="mr-1">🎉</span>
                  Puzzle solved!
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Original image preview and controls */}
        <div className="flex-1 flex flex-col gap-4">
          <div>
            <p className="font-semibold mb-2">Original image:</p>
            <div className="border border-gray-300 p-2 bg-white max-w-lg">
              <img
                src={elephantImg}
                alt="Original elephant puzzle"
                className="w-full h-auto max-h-[min(50vh,400px)] object-contain object-center"
                decoding="async"
              />
            </div>
          </div>

          <div className="mt-2 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="bgColor" className="w-40">
                Background color:
              </label>
              <input
                id="bgColor"
                type="text"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 flex-1 text-sm"
                placeholder="e.g. white or #ff0000"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="steps" className="w-40">
                Number of steps to shuffle:
              </label>
              <input
                id="steps"
                type="number"
                min={1}
                max={20}
                value={shuffleSteps}
                onChange={(e) => setShuffleSteps(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 w-20 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleLoadPuzzle}
                className="px-3 py-1 rounded border border-gray-400 bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Load Puzzle
              </button>
              <button
                type="button"
                onClick={handleShuffle}
                className="px-3 py-1 rounded border border-gray-400 bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Shuffle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

