export interface Chunk {
  text: string;
  /** Offsets of this chunk within the full segment text. */
  start: number;
  end: number;
}

/**
 * Split narration into sentence-sized chunks. Short utterances keep speech engines reliable
 * (some stop long utterances part-way) and double as caption lines.
 * A sentence ends at . ! or ? followed by whitespace and a capital letter, quote or digit — so
 * decimals such as "0.75" are not split.
 */
export function splitIntoChunks(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) chunks.push({ text: trimmed, start: start + lead, end: start + lead + trimmed.length });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c !== '.' && c !== '!' && c !== '?') continue;
    let j = i + 1;
    while (j < text.length && /["'”’)\]]/.test(text[j]!)) j++;
    if (j >= text.length) break;
    if (!/\s/.test(text[j]!)) continue;
    let k = j;
    while (k < text.length && /\s/.test(text[k]!)) k++;
    if (k >= text.length || /[A-Z0-9"'“‘(]/.test(text[k]!)) {
      push(j);
      i = j - 1;
    }
  }
  push(text.length);
  return chunks;
}
