/**
 * Copy text to the clipboard.
 *
 * `navigator.clipboard` only exists in a secure context (https, or localhost).
 * On a plain-http origin — a school LAN, for example — the property is
 * `undefined`, and `navigator.clipboard.writeText(...)` throws *synchronously*.
 * A `.catch()` attached to that call therefore never runs, which is why the
 * previous implementation reported "Copied!" while copying nothing.
 *
 * Returns `true` only when a copy genuinely succeeded, so the caller can show
 * honest feedback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or clipboard unavailable — fall through to the legacy path.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
