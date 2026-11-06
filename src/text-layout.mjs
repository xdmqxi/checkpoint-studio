// Preserve words; split only words that cannot fit on a single line.
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const token of paragraph.match(/\S+\s*|\s+/gu) || []) {
      if (line && measure((line + token).trimEnd()) > maxWidth) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (measure(token.trimEnd()) > maxWidth) {
        for (const char of token) {
          if (line && measure(line + char) > maxWidth) {
            lines.push(line.trimEnd());
            line = "";
          }
          line += char;
        }
      } else line += token;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
