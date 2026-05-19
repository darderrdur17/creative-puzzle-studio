import { useCallback, useEffect, useState } from "react";
import { loadBestIdeasAnswer, saveBestIdeasAnswer } from "@/lib/bestIdeasAnswer";

export function useBestIdeasAnswer(userId: string | null) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setAnswer(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadBestIdeasAnswer(userId)
      .then((loaded) => {
        if (!cancelled) setAnswer(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your saved answer. You can enter it again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveAnswer = useCallback(
    async (text: string): Promise<boolean> => {
      if (!userId) {
        setError("Still connecting — please wait a moment and try again.");
        return false;
      }

      setSaving(true);
      setError(null);

      const result = await saveBestIdeasAnswer(userId, text);
      setSaving(false);

      if (!result.ok) {
        setError(result.error ?? "Could not save your answer.");
        return false;
      }

      setAnswer(text.trim().slice(0, 200));
      return true;
    },
    [userId],
  );

  return {
    answer,
    hasAnswer: !!answer?.trim(),
    loading,
    saving,
    error,
    setError,
    saveAnswer,
  };
}
