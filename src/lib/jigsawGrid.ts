import {
  getLevelFromDifficulty,
  getLevelGridConfig,
  type LevelGridConfig,
} from "@/lib/gameData";

/**
 * Grid configuration for a given session difficulty.
 *
 * Deliberately kept out of `JigsawImagePuzzle.tsx`: that module must only export
 * components for React Fast Refresh to work, and this is a plain function.
 */
export function getGridConfig(difficulty: string): LevelGridConfig {
  const level = getLevelFromDifficulty(difficulty);
  return getLevelGridConfig(level);
}
