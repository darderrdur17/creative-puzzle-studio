/**
 * RFC-4180 CSV serialisation.
 *
 * Kept in its own module (rather than inside `TeacherDashboard.tsx`) so it can
 * be unit-tested without mounting the page — and so that page module keeps
 * exporting only a component, which React Fast Refresh requires.
 *
 * Two defects motivated this:
 *  1. an embedded `"` in a nickname shifted every later column;
 *  2. a nickname starting with `=`, `+`, `-`, `@`, a tab or a CR is executed as
 *     a formula by Excel and Google Sheets — CSV injection from student input.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Neutralise the formula trigger *before* quoting, so the apostrophe ends up
  // inside the quotes and the cell renders as literal text.
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Serialise a header row plus data rows. RFC 4180 requires CRLF line breaks. */
export function buildCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>
): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return lines.join("\r\n");
}
