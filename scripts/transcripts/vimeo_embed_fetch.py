#!/usr/bin/env python3
"""
Fetch a Marblehead TV Vimeo meeting's en-x-autogen caption track (and video
duration) via the embed player config, bypassing yt-dlp's Vimeo path.

Why this exists: as of ~July 2026 Vimeo returns HTTP 401 on the anonymous
OAuth token endpoint that yt-dlp's Vimeo extractor depends on ("Unable to
download macos API JSON: HTTP Error 401"). Its fallback clients need a login
(`web`) or a cached token (`android`/`ios`). The result is that yt-dlp reports
"no caption track" for every MHTV video and the ingest silently stops adding
meetings while still exiting 0.

The captions themselves are still public: the embed player
(player.vimeo.com/video/<id>?h=<hash>) carries a `window.playerConfig` blob
with `request.text_tracks[].url` (a signed captions.vimeo.com VTT URL) and
`video.duration`. player.vimeo.com rejects non-browser TLS fingerprints with
401, so we impersonate a real browser via curl_cffi.

Usage:
  python3 vimeo_embed_fetch.py <vimeo_id> --out <vtt_path> [--referer <url>]

On success: writes the VTT to <vtt_path>, prints one JSON line to stdout, exits 0:
  {"ok": true, "duration": 5947, "vtt_bytes": 161865, "lang": "en-x-autogen"}
On failure: prints a JSON line with "ok": false and a reason, exits non-zero.
Exit codes: 1 network/HTTP, 2 no caption track, 3 missing dependency.
"""
import argparse
import html
import json
import re
import sys
import time

try:
    from curl_cffi import requests
except ImportError:
    print(json.dumps({"ok": False, "error": "curl_cffi not installed"}))
    sys.exit(3)

# Explicit, version-pinned TLS fingerprints, tried in order until one gets a
# 200 out of player.vimeo.com. Never use curl_cffi's bare aliases ("chrome",
# "safari"): those resolve to DEFAULT_CHROME / DEFAULT_SAFARI, which advance
# with every curl_cffi release. Vimeo's edge blocklists the newest Chrome
# fingerprints, so a bare alias works the day it is written and silently 401s
# months later when the dependency ships a newer default. That is exactly how
# this broke: "chrome" resolved to chrome146 on curl_cffi 0.15/0.16, which
# Vimeo rejects, and the ingest reported "no caption track" for every meeting.
# Vimeo will eventually blocklist these too; when it does, add a newer pin at
# the front rather than reaching for an alias.
IMPERSONATE_TARGETS = ("chrome124", "safari17_0", "chrome120")

# Pause between fingerprint attempts. Vimeo throttles per IP, so consecutive
# embed requests can 401 regardless of fingerprint.
RETRY_SLEEP_SEC = 3

assert all(any(ch.isdigit() for ch in t) for t in IMPERSONATE_TARGETS), (
    "impersonate targets must be version-pinned (e.g. 'chrome124'), not "
    "floating aliases like 'chrome'"
)


def extract_balanced_object(text, anchor):
    """Return the first balanced {...} JSON object that follows `anchor`.

    A plain regex can't match the playerConfig blob because it contains `};`
    inside nested objects and strings. Walk the braces instead, honoring string
    literals and escapes.
    """
    start = text.find(anchor)
    if start < 0:
        return None
    brace = text.find("{", start)
    if brace < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for k in range(brace, len(text)):
        c = text[k]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[brace:k + 1]
    return None


def fail(msg, code=1, **extra):
    print(json.dumps({"ok": False, "error": msg, **extra}))
    sys.exit(code)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vimeo_id")
    ap.add_argument("--out", required=True)
    ap.add_argument("--referer", default="https://vimeo.com/")
    a = ap.parse_args()

    # Steps 1 and 2 are retried per fingerprint: the share page can 200 while
    # the embed 401s, and only the fingerprint distinguishes the two outcomes.
    session = pr = None
    attempts = []
    for i, target in enumerate(IMPERSONATE_TARGETS):
        # Vimeo also throttles per IP: three back-to-back embed requests can
        # all 401 even on a fingerprint that works before and after. Without
        # this pause the chain defeats itself and reports every target dead.
        if i:
            time.sleep(RETRY_SLEEP_SEC)
        session = requests.Session(impersonate=target)

        # 1. The public share page carries the signed embed URL (with the
        #    video's privacy hash) in its twitter:player card. Fall back to the
        #    bare embed URL if the tag is missing (public, non-hashed videos).
        try:
            og = session.get(f"https://vimeo.com/{a.vimeo_id}", timeout=30)
        except Exception as e:  # noqa: BLE001 - surface the transport error
            attempts.append(f"{target}: share page fetch failed: {e}")
            continue
        m = re.search(r'"twitter:player" content="([^"]+)"', og.text)
        player_url = html.unescape(m.group(1)) if m else (
            f"https://player.vimeo.com/video/{a.vimeo_id}"
        )

        # 2. The embed player page inlines window.playerConfig with the caption
        #    tracks and duration.
        try:
            pr = session.get(
                player_url, headers={"Referer": a.referer}, timeout=30
            )
        except Exception as e:  # noqa: BLE001
            attempts.append(f"{target}: embed fetch failed: {e}")
            continue
        if pr.status_code == 200:
            break
        attempts.append(f"{target}: embed HTTP {pr.status_code}")
        pr = None

    if pr is None:
        fail("embed unreachable with every impersonate target", 1,
             attempts=attempts)
    raw = extract_balanced_object(pr.text, "playerConfig")
    if not raw:
        fail("playerConfig not found in embed page", 1)
    try:
        cfg = json.loads(raw)
    except json.JSONDecodeError as e:
        fail(f"playerConfig JSON parse failed: {e}", 1)

    duration = int((cfg.get("video") or {}).get("duration") or 0)
    tracks = (cfg.get("request") or {}).get("text_tracks") or []
    # Prefer the Vimeo machine-generated English track; accept any en* autogen.
    track = next((t for t in tracks if t.get("lang") == "en-x-autogen"), None)
    if track is None:
        track = next(
            (t for t in tracks if str(t.get("lang", "")).startswith("en")), None
        )
    if not track or not track.get("url"):
        fail("no en caption track", 2, n_tracks=len(tracks))

    cap_url = track["url"]
    if cap_url.startswith("//"):
        cap_url = "https:" + cap_url

    # 3. Download the signed VTT. The captions host wants a player referer.
    try:
        vr = session.get(
            cap_url, headers={"Referer": "https://player.vimeo.com/"}, timeout=60
        )
    except Exception as e:  # noqa: BLE001
        fail(f"caption fetch failed: {e}")
    if vr.status_code != 200:
        fail(f"caption HTTP {vr.status_code}", 1)
    if "WEBVTT" not in vr.text[:32]:
        fail("caption response is not WEBVTT", 1)

    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write(vr.text)
    print(json.dumps({
        "ok": True,
        "duration": duration,
        "vtt_bytes": len(vr.text),
        "lang": track.get("lang"),
    }))


if __name__ == "__main__":
    main()
