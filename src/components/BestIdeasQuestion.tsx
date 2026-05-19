import { useEffect, useId, useState } from "react";
import { Lightbulb, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface BestIdeasQuestionProps {
  onSubmit: (answer: string) => void | Promise<void>;
  submitting?: boolean;
  disabled?: boolean;
  error?: string | null;
}

/** Avoid auto-focus on touch devices — prevents keyboard covering the form on phones */
function usePreferNoAutoFocus() {
  const [skipAutoFocus, setSkipAutoFocus] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 768px)").matches;
    setSkipAutoFocus(coarse || narrow);
  }, []);
  return skipAutoFocus;
}

export function BestIdeasQuestion({
  onSubmit,
  submitting,
  disabled,
  error,
}: BestIdeasQuestionProps) {
  const [answer, setAnswer] = useState("");
  const skipAutoFocus = usePreferNoAutoFocus();
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();

  const handleSubmit = async () => {
    const trimmed = answer.trim();
    if (!trimmed || submitting || disabled) return;
    await onSubmit(trimmed);
  };

  return (
    <Card className="w-full shadow-xl border-stage-incubation/30">
      <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle
          id={labelId}
          className="flex items-start gap-2 text-base sm:text-lg md:text-xl leading-snug"
        >
          <Lightbulb
            className="h-5 w-5 sm:h-6 sm:w-6 text-stage-incubation shrink-0 mt-0.5"
            aria-hidden
          />
          Where do you get your best ideas?
        </CardTitle>
        <CardDescription id={hintId} className="text-sm leading-relaxed">
          Your answer becomes one of your{" "}
          <span className="font-medium text-foreground">Incubation</span> puzzle pieces when you play.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="space-y-1">
          <label htmlFor="best-ideas-answer" className="sr-only">
            Where do you get your best ideas?
          </label>
          <Textarea
            id="best-ideas-answer"
            placeholder="e.g. on my morning walk, in the shower, doodling in class…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={200}
            rows={3}
            disabled={disabled || submitting}
            autoFocus={!skipAutoFocus}
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="sentences"
            aria-labelledby={labelId}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={!!error}
            className="min-h-[88px] resize-y text-base leading-relaxed touch-manipulation sm:min-h-[96px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {answer.length}/200
          </p>
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            {error}
          </p>
        )}

        <Button
          type="button"
          className="w-full gap-2 min-h-[48px] touch-manipulation text-base sm:min-h-[44px]"
          disabled={!answer.trim() || submitting || disabled}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "Saving…" : "Continue"}
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}

