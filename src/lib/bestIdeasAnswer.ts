const STORAGE_PREFIX = "puzzle-best-ideas";
const MAX_LENGTH = 200;

export function normalizeBestIdeasAnswer(raw: string): string {
  return raw.trim().slice(0, MAX_LENGTH);
}

export function getBestIdeasAnswerLocal(userId: string): string | null {
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!value) return null;
    const normalized = normalizeBestIdeasAnswer(value);
    return normalized || null;
  } catch {
    return null;
  }
}

export function setBestIdeasAnswerLocal(userId: string, answer: string): boolean {
  try {
    const normalized = normalizeBestIdeasAnswer(answer);
    if (!normalized) return false;
    localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, normalized);
    return true;
  } catch {
    return false;
  }
}

export function hasBestIdeasAnswerLocal(userId: string): boolean {
  return !!getBestIdeasAnswerLocal(userId);
}

export function getBestIdeasAnswer(userId: string): string | null {
  return getBestIdeasAnswerLocal(userId);
}

export function setBestIdeasAnswer(userId: string, answer: string): void {
  setBestIdeasAnswerLocal(userId, answer);
}

export function hasBestIdeasAnswer(userId: string): boolean {
  return hasBestIdeasAnswerLocal(userId);
}

export async function loadBestIdeasAnswer(userId: string): Promise<string | null> {
  return getBestIdeasAnswerLocal(userId);
}

export async function saveBestIdeasAnswer(
  userId: string,
  answer: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeBestIdeasAnswer(answer);
  if (!normalized) {
    return { ok: false, error: "Please enter your answer before continuing." };
  }

  const localOk = setBestIdeasAnswerLocal(userId, normalized);
  if (!localOk) {
    return {
      ok: false,
      error: "Could not save on this device. Check that storage is enabled and try again.",
    };
  }

  return { ok: true };
}
