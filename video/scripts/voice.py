"""Speak voice/script.txt with a Microsoft Edge neural voice.

Writes public/voice/voiceover.mp3 and src/generated/voice.json, which holds
every spoken word with its start and end in seconds so captions and scene cuts
can follow the voice.
"""

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
TICKS_PER_SECOND = 10_000_000  # edge-tts reports offsets in 100 ns ticks


async def speak(text: str, voice: str, rate: str, pitch: str, audio_path: Path) -> list[dict]:
    words = []
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    with audio_path.open("wb") as audio:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / TICKS_PER_SECOND
                words.append({
                    "text": chunk["text"],
                    "start": round(start, 3),
                    "end": round(start + chunk["duration"] / TICKS_PER_SECOND, 3),
                })
    return words


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voice", default="en-US-AndrewMultilingualNeural")
    parser.add_argument("--rate", default="+8%")
    parser.add_argument("--pitch", default="+0Hz")
    parser.add_argument("--out", help="write only an mp3 sample to this path (no timings)")
    args = parser.parse_args()

    text = (ROOT / "voice" / "script.txt").read_text(encoding="utf-8").strip()
    if args.out:
        asyncio.run(speak(text, args.voice, args.rate, args.pitch, Path(args.out)))
        return

    audio_path = ROOT / "public" / "voice" / "voiceover.mp3"
    timings_path = ROOT / "src" / "generated" / "voice.json"
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    timings_path.parent.mkdir(parents=True, exist_ok=True)

    words = asyncio.run(speak(text, args.voice, args.rate, args.pitch, audio_path))
    timings = {"voice": args.voice, "rate": args.rate, "words": words}
    timings_path.write_text(json.dumps(timings, indent=2) + "\n", encoding="utf-8")
    print(f"{len(words)} words, {words[-1]['end']:.2f}s, voice {args.voice}")


if __name__ == "__main__":
    main()
