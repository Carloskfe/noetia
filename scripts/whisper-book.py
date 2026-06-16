#!/usr/bin/env python3
"""
Automated Whisper transcription pipeline for a LibriVox book.

Usage:
  python3 scripts/whisper-book.py \
    --url "https://librivox.org/niebla-by-miguel-de-unamuno/" \
    --slug "niebla" \
    --dir "Niebla" \
    [--lang es] [--model medium] [--keep-audio] [--dry-run]

Steps performed:
  1. Scrape LibriVox page → find archive.org identifier
  2. Query archive.org metadata API → list 64kb MP3 chapter files
  3. Download chapter MP3s to a temp directory
  4. Run Whisper on each chapter (word_timestamps=True, output_format=vtt)
  5. Move VTTs to transcriptions/<dir>/
  6. Run merge-vtt.py → transcriptions/<slug>.merged.vtt
  7. (Optional) Delete downloaded audio files
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
TRANSCRIPTIONS = REPO_ROOT / "transcriptions"
MERGE_SCRIPT = REPO_ROOT / "scripts" / "merge-vtt.py"


# ── helpers ──────────────────────────────────────────────────────────────────

def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Noetia-Whisper-Bot"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def fetch_bytes(url: str, dest: Path, label: str = "") -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Noetia-Whisper-Bot"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        total = int(r.headers.get("Content-Length", 0))
        downloaded = 0
        while chunk := r.read(65536):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded * 100 // total
                print(f"\r  {label}: {pct}%", end="", flush=True)
    print()


def archive_identifier_from_zip(zip_url: str) -> str:
    """Extract archive.org identifier from a compress or download URL."""
    m = re.search(r"archive\.org/(?:compress|download)/([^/?#]+)", zip_url)
    if not m:
        raise ValueError(f"Cannot extract archive.org identifier from: {zip_url}")
    return m.group(1)


def scrape_librivox(librivox_url: str) -> str:
    """Return archive.org identifier for the LibriVox book page."""
    print(f"Fetching LibriVox page: {librivox_url}")
    html = fetch(librivox_url)

    # Try zip URL first (most reliable)
    m = re.search(r'href="(https://archive\.org/compress/[^"]+\.zip[^"]*)"', html, re.I)
    if m:
        identifier = archive_identifier_from_zip(m.group(1))
        print(f"  Found identifier (zip): {identifier}")
        return identifier

    # Fall back to M4B link
    m = re.search(r'href="(https://archive\.org/download/([^"]+?)(?:/[^"]*)?\.m4b)"', html, re.I)
    if m:
        identifier = m.group(2)
        print(f"  Found identifier (m4b): {identifier}")
        return identifier

    # Fall back to any archive.org download link
    m = re.search(r'href="https://archive\.org/(?:compress|download)/([^/"]+)', html, re.I)
    if m:
        identifier = m.group(1)
        print(f"  Found identifier (generic): {identifier}")
        return identifier

    raise RuntimeError("Could not find archive.org identifier on LibriVox page")


def get_chapter_mp3s(identifier: str) -> list[dict]:
    """Return sorted list of chapter MP3 file dicts from archive.org metadata."""
    api_url = f"https://archive.org/metadata/{identifier}"
    print(f"Querying archive.org metadata: {api_url}")
    raw = fetch(api_url)
    meta = json.loads(raw)
    files = meta.get("files", [])

    # Prefer 64kb MP3s; fall back to any MP3; exclude zip/m4b
    def is_mp3(f: dict) -> bool:
        name = f.get("name", "")
        fmt = f.get("format", "").lower()
        return name.lower().endswith(".mp3") and fmt in ("mp3", "vbr mp3", "")

    mp3s = [f for f in files if is_mp3(f)]

    # Prefer 64kb files when multiple bitrates exist
    kb64 = [f for f in mp3s if "64kb" in f.get("name", "").lower() or "64kb" in f.get("format", "").lower()]
    chosen = kb64 if kb64 else mp3s

    if not chosen:
        raise RuntimeError(f"No MP3 files found in archive.org item: {identifier}")

    # Sort by embedded number (chapter order)
    def sort_key(f: dict) -> tuple:
        name = f.get("name", "")
        nums = re.findall(r"\d+", name)
        return tuple(int(n) for n in nums) if nums else (0,)

    chosen.sort(key=sort_key)
    print(f"  Found {len(chosen)} chapter MP3s")
    return chosen


def download_chapters(identifier: str, files: list[dict], dest_dir: Path) -> list[Path]:
    """Download chapter MP3s and return list of local paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    base = f"https://archive.org/download/{identifier}"
    paths = []
    for i, f in enumerate(files):
        name = f["name"]
        url = f"{base}/{urllib.parse.quote(name)}"
        local = dest_dir / name
        if local.exists():
            print(f"  [{i+1}/{len(files)}] Already downloaded: {name}")
        else:
            print(f"  [{i+1}/{len(files)}] Downloading: {name}")
            fetch_bytes(url, local, label=name)
        paths.append(local)
    return paths


def run_whisper(audio_path: Path, out_dir: Path, lang: str, model: str) -> Path:
    """Run Whisper on one audio file; return path to the generated .vtt."""
    cmd = [
        "whisper", str(audio_path),
        "--model", model,
        "--language", lang,
        "--word_timestamps", "True",
        "--output_format", "vtt",
        "--output_dir", str(out_dir),
    ]
    print(f"    whisper {audio_path.name} ...", end="", flush=True)
    result = subprocess.run(cmd, capture_output=True, text=True)
    combined = result.stdout + result.stderr
    if result.returncode != 0 or "Skipping" in combined:
        print(f"\n  Whisper FAILED for {audio_path.name}")
        print(combined[-2000:])
        if "ffmpeg" in combined:
            raise RuntimeError("ffmpeg not found — install it with: apt-get install -y ffmpeg")
        raise RuntimeError(f"Whisper failed on {audio_path.name}")
    print(" done")
    # Whisper names output file same as input but with .vtt extension
    vtt = out_dir / (audio_path.stem + ".vtt")
    if not vtt.exists():
        # Search for any vtt written to out_dir to help diagnose filename changes
        vtts = list(out_dir.glob("*.vtt"))
        hint = f" (found: {[v.name for v in vtts]})" if vtts else " (no .vtt files in output dir)"
        raise RuntimeError(f"Expected VTT not found: {vtt}{hint}")
    return vtt


def run_merge(vtt_dir: Path, out_path: Path) -> None:
    cmd = ["python3", str(MERGE_SCRIPT), "--dir", str(vtt_dir), "--out", str(out_path)]
    print(f"\nMerging VTTs → {out_path.name}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr)
        raise RuntimeError("merge-vtt.py failed")
    print(result.stdout.strip())


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    import urllib.parse  # noqa: needed inside fetch_bytes

    p = argparse.ArgumentParser(description="Whisper transcription pipeline for a LibriVox book")
    p.add_argument("--url", required=True, help="LibriVox book page URL")
    p.add_argument("--slug", required=True, help="Output slug, e.g. 'niebla' → transcriptions/niebla.merged.vtt")
    p.add_argument("--dir", required=True, help="Transcriptions subdir name, e.g. 'Niebla'")
    p.add_argument("--lang", default="es", help="Whisper language code (default: es)")
    p.add_argument("--model", default="medium", help="Whisper model (default: medium)")
    p.add_argument("--keep-audio", action="store_true", help="Keep downloaded MP3 files after transcription")
    p.add_argument("--dry-run", action="store_true", help="List files that would be processed, then exit")
    args = p.parse_args()

    vtt_dir = TRANSCRIPTIONS / args.dir
    merged_out = TRANSCRIPTIONS / f"{args.slug}.merged.vtt"

    if merged_out.exists():
        print(f"Merged VTT already exists: {merged_out}")
        print("Delete it and the VTT directory to re-run.")
        sys.exit(0)

    # Step 1: identify archive.org item
    identifier = scrape_librivox(args.url)

    # Step 2: get chapter MP3 list
    files = get_chapter_mp3s(identifier)

    if args.dry_run:
        print("\nDry run — would process:")
        for f in files:
            print(f"  {f['name']}")
        sys.exit(0)

    # Step 3: download
    audio_dir = REPO_ROOT / "tmp_audio" / args.slug
    audio_paths = download_chapters(identifier, files, audio_dir)

    # Step 4: run Whisper
    vtt_dir.mkdir(parents=True, exist_ok=True)
    for i, audio in enumerate(audio_paths):
        vtt = vtt_dir / (audio.stem + ".vtt")
        if vtt.exists():
            print(f"\n[{i+1}/{len(audio_paths)}] Already done: {audio.name}")
            continue
        print(f"\n[{i+1}/{len(audio_paths)}] Transcribing: {audio.name}")
        vtt = run_whisper(audio, vtt_dir, args.lang, args.model)
        print(f"  → {vtt.name}")

    # Step 5: merge
    run_merge(vtt_dir, merged_out)

    # Step 6: cleanup
    if not args.keep_audio:
        print(f"\nCleaning up audio files in {audio_dir}")
        shutil.rmtree(audio_dir, ignore_errors=True)
        parent = audio_dir.parent
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()

    print(f"\nDone! → {merged_out}")
    print("\nNext steps:")
    print(f"  git add transcriptions/")
    print(f"  git commit -m 'chore: add Whisper VTT for {args.dir}'")
    print(f"  git push")
    print(f"\nThen on server:")
    print(f"  git pull && docker cp transcriptions/{args.slug}.merged.vtt noetia-api-1:/app/transcriptions/")
    print(f"  docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api \\")
    print(f"    node dist/ingestion/seed-sync-whisper.js --book \"{args.dir}\" --transcript /app/transcriptions/{args.slug}.merged.vtt")


if __name__ == "__main__":
    main()
