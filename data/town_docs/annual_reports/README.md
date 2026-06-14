# Annual Town Reports: text extracts

Plain-text extracts of every Annual Town Report published on
[marbleheadma.gov/document/annual-town-reports](https://marbleheadma.gov/document/annual-town-reports/),
covering calendar years **2006 through 2025** (20 reports).

## What's here

- `Annual-Report-YYYY.txt` &ndash; text extracted from the official PDF
  using `pdftotext -layout` (preserves multi-column tables for
  searchability).
- `manifest.csv` &ndash; one row per report with `year`, `pdf_url`,
  `pdf_size_mb`, `pages`, `txt_size_kb`, `extraction_method`,
  `extracted_at`.
- PDFs are **not** committed. See `.gitignore`. To re-fetch a PDF, use
  the URL from `manifest.csv`.

## What's in each report

Department writeups (Selectmen, Police, Fire, <abbr class="g" title="Department of Public Works">DPW</abbr>, Schools, Library,
Recreation, Health, <abbr class="g" title="Council on Aging">COA</abbr>, etc.), warrant articles and results for Annual
plus Special Town Meetings, election warrants and results (annual,
state primary, state election), employee rosters with salaries, vital
statistics (births, marriages, deaths), boards and committees, and the
Town Treasurer's financial summary.

These are **secondary** to the <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> for any financial figure; the
<abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> is the audited primary source. Use the annual report for
narrative context, town meeting results, and historical
employee/department rosters.

## Extraction caveats

- Every PDF has a real text layer; no OCR was needed.
- `pdftotext -layout` preserves column structure but introduces a lot
  of leading whitespace. For most queries this is fine; if you need
  paragraph-flow text, re-extract with `pdftotext` (no flag).
- Trailing whitespace was stripped; otherwise text is verbatim.
- 2012 and 2022 extracts are 4&ndash;5x larger than other years because
  those PDFs use unusually wide column layouts (more padding spaces
  per row), not because they contain more content.

## Citation

Cite as: *Marblehead Annual Town Report YYYY, [Department Name], page
N*. The page number from the PDF (visible in the report's table of
contents) is the canonical reference.
