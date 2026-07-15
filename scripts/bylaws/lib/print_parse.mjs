// Parse the eCode "print view" plain text of Part I into structured chapters.
//
// Observed line structure (see data/bylaws-history/raw/ecode-part1.txt):
//   Chapter 13. Animals                     <- chapter start
//   [HISTORY: ...]                          <- chapter-level blurb (no date)
//   Article I. Swine                        <- optional sub-article grouping
//   [Adopted 3-11-1954 TM by Art. 73]       <- note (attaches to the section it precedes)
//   § 13-1. Keeping of swine prohibited.    <- section: ref + heading
//   No person ... shall keep swine ...      <- body (one or more lines)
//   A.                                      <- subsection letter (own line)
//   Prohibition. No person shall ...        <- subsection text
//   [Amended 3-14-1972 ATM by Art. 30]      <- note may also trail a section's body
//
// A note line belongs to the current section if one is open; a note appearing
// before the first section of a chapter/article is held and prepended to the
// next section's noteText (that section is the thing being adopted/amended).

const CHAPTER_RE = /^Chapter\s+([\dA-Za-z]+)\.\s+(.+)$/;
const ARTICLE_RE = /^Article\s+[IVXLCDM]+\.\s+/;
const SECTION_RE = /^§\s*([\dA-Za-z]+-[\dA-Za-z.]+?)\.\s+(.+)$/;
const NOTE_RE = /^\[.*\]\s*$/;

export function parsePrintText(text) {
  const chapters = [];
  let chapter = null;
  let section = null;
  let pendingNote = ''; // note(s) seen before the next section opens

  const closeSection = () => {
    if (section && chapter) {
      section.body = section.bodyLines.join('\n').trim();
      delete section.bodyLines;
      chapter.sections.push(section);
    }
    section = null;
  };
  const closeChapter = () => {
    closeSection();
    if (chapter) chapters.push(chapter);
    chapter = null;
    pendingNote = '';
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const chap = CHAPTER_RE.exec(line);
    if (chap) {
      closeChapter();
      chapter = { chapter: chap[1], chapterTitle: chap[2].trim(), sections: [] };
      continue;
    }
    if (!chapter) continue; // preamble before first chapter

    if (ARTICLE_RE.test(line)) { closeSection(); continue; } // grouping only

    const sec = SECTION_RE.exec(line);
    if (sec) {
      closeSection();
      section = { ref: sec[1], heading: sec[2].trim(), noteText: pendingNote, bodyLines: [] };
      pendingNote = '';
      continue;
    }

    if (NOTE_RE.test(line)) {
      if (section) section.noteText = (section.noteText ? section.noteText + ' ' : '') + line;
      else pendingNote = (pendingNote ? pendingNote + ' ' : '') + line;
      continue;
    }

    if (section) section.bodyLines.push(line);
  }
  closeChapter();
  return chapters;
}
