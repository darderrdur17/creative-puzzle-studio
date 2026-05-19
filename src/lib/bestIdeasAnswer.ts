import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "puzzle-best-ideas";
export const BEST_IDEAS_META_KEY = "best_ideas_answer";
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

/** @deprecated use getBestIdeasAnswerLocal — kept for sync reads in game */
export function getBestIdeasAnswer(userId: string): string | null {
  return getBestIdeasAnswerLocal(userId);
}

export function setBestIdeasAnswer(userId: string, answer: string): void {
  setBestIdeasAnswerLocal(userId, answer);
}

export function hasBestIdeasAnswer(userId: string): boolean {
  return hasBestIdeasAnswerLocal(userId);
}

function readMetadataAnswer(metadata: Record<string, unknown> | undefined): string | null {
  const raw = metadata?.[BEST_IDEAS_META_KEY];
  if (typeof raw !== "string") return null;
  const normalized = normalizeBestIdeasAnswer(raw);
  return normalized || null;
}

/** Load from local cache, then Supabase user metadata (same account, new browser tab / device session). */
export async function loadBestIdeasAnswer(userId: string): Promise<string | null> {
  const local = getBestIdeasAnswerLocal(userId);
  if (local) return local;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== userId) return null;

    const fromMeta = readMetadataAnswer(data.user.user_metadata);
    if (fromMeta) {
      setBestIdeasAnswerLocal(userId, fromMeta);
      return fromMeta;
    }
  } catch {
    // offline or auth unavailable — local only
  }
  return null;
}

/** Persist locally and to Supabase user metadata when signed in. */
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

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { ok: true };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { [BEST_IDEAS_META_KEY]: normalized },
    });
    if (updateError) {
      return { ok: true };
    }
  } catch {
    return { ok: true };
  }

  return { ok: true };
}

/** Copy best-ideas answer from a prior session (e.g. anonymous) into a registered student account. */
export async function migrateBestIdeasAnswer(
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  const answer = await loadBestIdeasAnswer(fromUserId);
  if (!answer) return;

  await saveBestIdeasAnswer(toUserId, answer);
}
