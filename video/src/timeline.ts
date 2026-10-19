import voice from "./generated/voice.json";

export const FPS = 30;

export interface Word {
  text: string;
  start: number;
  end: number;
}

export const WORDS: Word[] = voice.words;
export const VOICE_END = WORDS[WORDS.length - 1].end;

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Index of the first spoken word of `phrase` at or after word `from`, so cuts
 * follow the voice even when the script or voice changes.
 */
export function findPhrase(phrase: string, from = 0): number {
  const target = phrase.split(/\s+/).map(normalize).filter(Boolean);
  for (let i = from; i + target.length <= WORDS.length; i++) {
    if (target.every((token, j) => normalize(WORDS[i + j].text) === token)) return i;
  }
  throw new Error(`"${phrase}" is not in the voiceover (after word ${from}). Check voice/script.txt.`);
}

/** Seconds at which `phrase` starts being spoken. */
export const timeOf = (phrase: string, from = 0) => WORDS[findPhrase(phrase, from)].start;

export const toFrames = (seconds: number) => Math.round(seconds * FPS);

/** Groups words into short caption lines, breaking on pauses and every few words. */
export function captionLines(words: Word[], maxWords = 3, pause = 0.2): Word[][] {
  const lines: Word[][] = [];
  for (const word of words) {
    const line = lines[lines.length - 1];
    if (line && line.length < maxWords && word.start - line[line.length - 1].end < pause) line.push(word);
    else lines.push([word]);
  }
  return lines;
}
