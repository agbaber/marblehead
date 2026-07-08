#!/usr/bin/env python3
"""Transcribe queued MHTV Vimeo videos with local faster-whisper, emitting VTT.

Backfill companion to backfill_auto.mjs for meetings that have no
en-x-autogen caption track on Vimeo (mostly 2020-2022 uploads). Produces
one .vtt per meeting in a persistent cache; scripts/transcripts/backfill_whisper.mjs
renders those VTTs into _transcripts/ markdown.

Usage:
  python3 scripts/transcripts/whisper_worker.py [--queue FILE] [--cache DIR] [--limit N]

Queue file: TSV of <vimeo_id> <slug> <duration_seconds>, one row per meeting.
Rows whose VTT already exists in the cache are skipped, so the worker is
safe to re-run after an interruption.

Runs CPU-only. Deliberately capped at 2 threads and meant to be launched
under `nice` so it can share a small box with other workloads.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

YT_DLP = os.environ.get("YT_DLP", str(Path.home() / ".local/bin/yt-dlp"))
MODEL_NAME = "small.en"
CPU_THREADS = 2

# faster-whisper computes the mel spectrogram for the whole file in one
# numpy FFT; past ~1.5h of audio that single allocation reaches multiple GB
# and OOMs a small box. Split longer recordings into fixed windows and
# offset the cue timestamps when merging.
CHUNK_SECONDS = 1800

# Bias the decoder toward local proper nouns it otherwise mangles
# ("Marvel head" for Marblehead was the top offender in benchmarking).
INITIAL_PROMPT = (
    "Meeting of a town board in Marblehead, Massachusetts. "
    "Speakers mention the Select Board, School Committee, Finance Committee, "
    "Board of Health, Town Meeting, Abbot Hall, and Proposition 2 1/2 overrides."
)


def fmt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int(seconds % 3600 // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def write_vtt(segments, out_path: Path) -> int:
    lines = ["WEBVTT", ""]
    n = 0
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        lines.append(f"{fmt_ts(seg.start)} --> {fmt_ts(seg.end)}")
        lines.append(text)
        lines.append("")
        n += 1
    out_path.write_text("\n".join(lines))
    return n


def download_audio(vimeo_id: str, audio_dir: Path) -> Path | None:
    out = audio_dir / f"{vimeo_id}.mp3"
    if out.exists():
        return out
    res = subprocess.run(
        [YT_DLP, "-f", "ba/b", "-x", "--audio-format", "mp3",
         "--audio-quality", "32k", "-o", str(audio_dir / f"{vimeo_id}.%(ext)s"),
         f"https://vimeo.com/{vimeo_id}"],
        capture_output=True, text=True,
    )
    if not out.exists():
        print(f"FAIL download {vimeo_id}: {res.stderr.strip().splitlines()[-1] if res.stderr else res.returncode}",
              flush=True)
        return None
    return out


class OffsetSegment:
    __slots__ = ("start", "end", "text")

    def __init__(self, seg, offset: float):
        self.start = seg.start + offset
        self.end = seg.end + offset
        self.text = seg.text


def transcribe_chunked(model, audio: Path, duration: float):
    """Yield transcript segments, splitting long audio into CHUNK_SECONDS
    windows so feature extraction stays within a bounded allocation."""
    if duration <= CHUNK_SECONDS * 1.2:
        segments, _ = model.transcribe(
            str(audio), vad_filter=True, beam_size=1,
            initial_prompt=INITIAL_PROMPT,
        )
        yield from segments
        return

    with tempfile.TemporaryDirectory(prefix="whisper-chunks-") as tmp:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(audio), "-f", "segment",
             "-segment_time", str(CHUNK_SECONDS), "-ar", "16000", "-ac", "1",
             os.path.join(tmp, "chunk-%04d.wav")],
            check=True, capture_output=True,
        )
        for i, chunk in enumerate(sorted(Path(tmp).glob("chunk-*.wav"))):
            segments, _ = model.transcribe(
                str(chunk), vad_filter=True, beam_size=1,
                initial_prompt=INITIAL_PROMPT,
            )
            offset = i * CHUNK_SECONDS
            for seg in segments:
                yield OffsetSegment(seg, offset)
            chunk.unlink()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", default=str(Path.home() / ".cache/whisper-backfill/queue.tsv"))
    ap.add_argument("--cache", default=str(Path.home() / ".cache/whisper-backfill"))
    ap.add_argument("--limit", type=int, default=0, help="stop after N meetings (0 = all)")
    args = ap.parse_args()

    cache = Path(args.cache)
    vtt_dir = cache / "vtt"
    audio_dir = cache / "audio"
    vtt_dir.mkdir(parents=True, exist_ok=True)
    audio_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    for line in Path(args.queue).read_text().splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            rows.append((parts[0], parts[1], float(parts[2])))

    todo = [r for r in rows if not (vtt_dir / f"{r[0]}.vtt").exists()]
    print(f"queue: {len(rows)} total, {len(todo)} to do", flush=True)
    if not todo:
        print("ALL DONE (nothing to do)", flush=True)
        return

    from faster_whisper import WhisperModel
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8",
                         cpu_threads=CPU_THREADS)

    done = failed = 0
    for vimeo_id, slug, duration in todo:
        if args.limit and done >= args.limit:
            break
        audio = download_audio(vimeo_id, audio_dir)
        if audio is None:
            failed += 1
            continue
        t0 = time.time()
        try:
            segments = transcribe_chunked(model, audio, duration)
            n = write_vtt(segments, vtt_dir / f"{vimeo_id}.vtt")
        except Exception as e:  # keep the queue moving past one bad file
            print(f"FAIL transcribe {slug} ({vimeo_id}): {e}", flush=True)
            failed += 1
            continue
        finally:
            audio.unlink(missing_ok=True)
        dt = time.time() - t0
        done += 1
        print(f"OK {slug} ({vimeo_id}) {duration:.0f}s audio, {n} cues, "
              f"{dt:.0f}s ({duration / dt:.1f}x) [{done}/{len(todo)}]", flush=True)

    print(f"ALL DONE done={done} failed={failed}", flush=True)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
