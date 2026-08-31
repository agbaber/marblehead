"""Extract an article's styled character stream from a report PDF.

Reports repeat an article number in several places (warrant, results, index);
only the warrant copy carries the strikethrough/underline markup. We gather every
"Article N" block and keep the one richest in styled characters, with running
headers / page numbers filtered out.
"""
import re

FURNITURE = re.compile(
    r"MARBLEHEAD TOWN REPORT|TOWN OF MARBLEHEAD|^\s*\d{1,4}\s*$|^_+$", re.I)
ARTICLE_HEAD = re.compile(r"^\s*Article\s+(\d+)\b")


def _rules(page):
    """Horizontal rule segments (thin lines / rects) usable as strike/underline."""
    segs = []
    for ln in page.lines:
        if abs(ln["top"] - ln["bottom"]) < 2.5:
            segs.append((ln["x0"], ln["x1"], (ln["top"] + ln["bottom"]) / 2))
    for r in page.rects:
        if (r["bottom"] - r["top"]) < 2.5:
            segs.append((r["x0"], r["x1"], (r["top"] + r["bottom"]) / 2))
    return segs


def _flag_chars(page):
    segs = _rules(page)
    out = []
    for c in page.chars:
        h = c["bottom"] - c["top"]
        # strike: a rule crossing the char's middle band (not the baseline underline)
        mid_lo, mid_hi = c["top"] + h * 0.2, c["bottom"] - h * 0.25
        struck = any(x0 - 1 <= c["x0"] and c["x1"] <= x1 + 1 and mid_lo < y < mid_hi
                     for (x0, x1, y) in segs)
        out.append({
            "text": c["text"], "fontname": c["fontname"],
            "x0": c["x0"], "x1": c["x1"], "top": c["top"], "bottom": c["bottom"],
            "page": page.page_number, "line": round(c["top"]),
            "bold": "Bold" in c["fontname"], "struck": struck,
        })
    return out


def _drop_furniture(chars):
    """Remove chars on lines whose text matches page furniture, preserving the
    PDF's native character order (re-sorting scrambles inserted/struck text)."""
    by_line = {}
    for c in chars:
        by_line.setdefault((c["page"], c["line"]), []).append(c)
    drop = {k for k, line in by_line.items()
            if FURNITURE.search("".join(c["text"] for c in line).strip())}
    return [c for c in chars if (c["page"], c["line"]) not in drop]


def all_chars(pdf):
    chars = []
    for page in pdf.pages:
        chars += _flag_chars(page)
    return _drop_furniture(chars)


def article_blocks(chars, article):
    """Yield char-lists, one per 'Article N' occurrence, up to the next article head."""
    # detect line starts that are article headers
    lines, cur, curkey = [], [], None
    for c in chars:
        k = (c["page"], c["line"])
        if k != curkey:
            if cur:
                lines.append(cur)
            cur, curkey = [], k
        cur.append(c)
    if cur:
        lines.append(cur)

    blocks, grabbing = [], None
    for line in lines:
        txt = "".join(c["text"] for c in line)
        m = ARTICLE_HEAD.match(txt)
        if m:
            n = int(m.group(1))
            if grabbing is not None:
                blocks.append(grabbing)
                grabbing = None
            if n == article:
                grabbing = []
        if grabbing is not None:
            grabbing += line
    if grabbing:
        blocks.append(grabbing)
    return blocks


def best_block_from_chars(chars, article):
    """The article's warrant copy from a pre-flagged char list (flag once per year)."""
    blocks = article_blocks(chars, article)
    if not blocks:
        return None
    scored = max(blocks, key=lambda b: sum(1 for c in b if c["bold"] or c["struck"]))
    styled = sum(1 for c in scored if c["bold"] or c["struck"])
    return scored if styled else None


def best_block(pdf, article):
    """Convenience: flag the whole PDF then find the block (one-off / tests only)."""
    return best_block_from_chars(all_chars(pdf), article)


def locate_articles(pdf, articles):
    """One cheap text pass over the report: page indices where each target
    'Article N' header appears. Flushes each page's cache to bound memory."""
    heads = {a: re.compile(r"^\s*Article\s+%d\b" % a, re.M) for a in articles}
    hits = {a: [] for a in articles}
    for i, page in enumerate(pdf.pages):
        txt = page.extract_text() or ""
        for a, rx in heads.items():
            if rx.search(txt):
                hits[a].append(i)
        page.flush_cache()
    return hits


def article_block_at(pdf, article, start_pages, window=2):
    """Flag only the located pages (+ window) for one article; pick the styled copy."""
    best = None
    for s in start_pages:
        chars = []
        for i in range(s, min(s + 1 + window, len(pdf.pages))):
            chars += _flag_chars(pdf.pages[i])
            pdf.pages[i].flush_cache()
        blk = best_block_from_chars(_drop_furniture(chars), article)
        if blk and (best is None or
                    sum(c["bold"] or c["struck"] for c in blk) >
                    sum(c["bold"] or c["struck"] for c in best)):
            best = blk
    return best
