"""Guard against the regression that silently froze meeting ingest.

vimeo_embed_fetch used `impersonate="chrome"`, which is not a fingerprint but a
pointer to curl_cffi's DEFAULT_CHROME. That pointer advances with every
curl_cffi release; once it reached chrome146, Vimeo's edge answered every embed
request with 401 and the ingest reported "no caption track" for all 454
meetings while still exiting 0.

These tests need no network. They assert the shape that prevents a recurrence:
targets are version-pinned, not aliases.
"""
import sys
from pathlib import Path

sys.path.insert(
    0, str(Path(__file__).resolve().parent.parent / "scripts" / "transcripts")
)
import vimeo_embed_fetch as vef

# curl_cffi's bare aliases. Any of these as a target means the fingerprint is
# whatever the installed dependency currently defaults to.
FLOATING_ALIASES = {"chrome", "safari", "edge", "firefox", "tor", "chrome_android"}


def test_targets_are_not_floating_aliases():
    for target in vef.IMPERSONATE_TARGETS:
        assert target not in FLOATING_ALIASES, (
            f"{target!r} is a curl_cffi alias that drifts with the dependency "
            "version; pin an explicit version like 'chrome124'"
        )


def test_targets_carry_a_version_number():
    for target in vef.IMPERSONATE_TARGETS:
        assert any(ch.isdigit() for ch in target), (
            f"{target!r} has no version number, so it cannot be a pinned "
            "fingerprint"
        )


def test_more_than_one_target():
    # A single pin fails closed the day Vimeo blocklists it, in the same silent
    # way as the original bug. The fallback chain is the point.
    assert len(vef.IMPERSONATE_TARGETS) > 1


def test_targets_are_unique():
    assert len(set(vef.IMPERSONATE_TARGETS)) == len(vef.IMPERSONATE_TARGETS)
