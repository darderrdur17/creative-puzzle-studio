import { describe, it, expect } from "vitest";
import { buildCsv, csvCell } from "@/lib/csv";

/* M9 regression: the export used to be `"${nickname}"`, which broke on an
   embedded quote and let a student nickname execute as a spreadsheet formula. */

describe("csvCell", () => {
  it("always quotes a plain value", () => {
    expect(csvCell("Ada")).toBe('"Ada"');
  });

  it("converts numbers to text", () => {
    expect(csvCell(42)).toBe('"42"');
  });

  it("renders null and undefined as an empty cell", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it("doubles an embedded quote so columns do not shift", () => {
    // The old code produced "He said "hi"" — three fields instead of one.
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("keeps a comma inside the quoted cell", () => {
    expect(csvCell("Winata, Derren")).toBe('"Winata, Derren"');
  });

  it("keeps a line break inside the quoted cell", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it.each([
    ["=1+1", "'=1+1"],
    ["+SUM(A1)", "'+SUM(A1)"],
    ["-2+3", "'-2+3"],
    ["@import", "'@import"],
    ["\tcmd", "'\tcmd"],
    ["\rcmd", "'\rcmd"],
  ])("neutralises the formula trigger in %j", (input, guarded) => {
    expect(csvCell(input)).toBe(`"${guarded}"`);
  });

  it("does not touch a value that merely contains an equals sign", () => {
    expect(csvCell("a=b")).toBe('"a=b"');
  });
});

describe("buildCsv", () => {
  it("quotes the header row too", () => {
    const csv = buildCsv(["Rank", "Nickname"], []);
    expect(csv).toBe('"Rank","Nickname"');
  });

  it("joins rows with CRLF as RFC 4180 requires", () => {
    const csv = buildCsv(["A"], [["1"], ["2"]]);
    expect(csv).toBe('"A"\r\n"1"\r\n"2"');
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("survives a full row of hostile input without breaking the column count", () => {
    const csv = buildCsv(
      ["Rank", "Nickname", "Score"],
      [
        [1, '=HYPERLINK("http://evil")', 300],
        [2, 'Smith, "Bob"', 200],
      ]
    );
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);

    // Parse one line the way a spreadsheet would, to prove the field count holds.
    const parseRow = (line: string) => {
      const fields: string[] = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            field += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            field += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(field);
          field = "";
        } else {
          field += ch;
        }
      }
      fields.push(field);
      return fields;
    };

    expect(parseRow(lines[0])).toEqual(["Rank", "Nickname", "Score"]);
    expect(parseRow(lines[1])).toEqual(["1", "'=HYPERLINK(\"http://evil\")", "300"]);
    expect(parseRow(lines[2])).toEqual(["2", 'Smith, "Bob"', "200"]);
  });
});
