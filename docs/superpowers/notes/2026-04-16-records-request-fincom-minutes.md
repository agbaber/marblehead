# Draft: public records request for FinCom meeting minutes

**To:** wileyk@marbleheadma.gov
**CC:** clerk@marbleheadma.gov (Jill Lewis, who confirmed minutes exist and pointed here)
**Subject:** Public records request, G.L. c. 66: Finance Committee meeting minutes, FY19 to present

---

Hello Ms. Wiley,

I'm writing to submit a public records request under G.L. c. 66, sec. 10 for Finance Committee meeting minutes.

Jill Lewis in the Town Clerk's office confirmed that the Finance Committee keeps meeting minutes and directed me to you as the Records Access Officer. I'm the resident behind marbleheaddata.org, a neutral civic data site; I'm compiling a citable record of what the Committee has discussed so residents have primary-source context for the override debate.

**What I'm asking for:**

- All approved Finance Committee meeting minutes from July 1, 2018 through the date of this request.
- Minutes for any Finance Committee subcommittee meetings in that same window (budget liaisons, warrant article hearings, etc.), if maintained separately.

I noticed the town's Finance Committee page at marbleheadma.gov/category/finance-committee/ posts agendas and annual reports but not meeting minutes; the minutes themselves appear to be internal records.

**Format and scope flexibility:**

- Electronic copies in whatever format is easiest on your end (native PDFs, scanned PDFs, Word). Email attachment or a shared drive link both work.
- If the full FY19 to present range is too large to produce at once, I'm happy to accept it in batches by fiscal year, or to narrow to a smaller period first (for example, FY24 to present, which would cover the structural-deficit era most relevant to the current override).
- If redactions are required for any reason, a copy with redactions is fine; please indicate the legal basis.

**Fees and logistics:**

- I understand the first four hours of staff time are not charged per the state records-access guidelines. If the request exceeds that, please send a written fee estimate before doing the work and I will decide whether to narrow scope or proceed.
- No rush on the ten-business-day response window; if it will take longer for a reason specified in the statute (volume, segregation, etc.), just let me know the revised timeline.

Thanks very much. Happy to refine any of this if a narrower scope is easier.

Best,
Andrew Baber
agbaber@gmail.com
marbleheaddata.org

---

## Notes for Andrew when sending

- Sending CC to Jill keeps her loop intact; she's the one who redirected you.
- The four-hour free-staff-time figure is from the 2016 Public Records Law amendments and the SPR 32.00 regulations; it's accurate as of 2026.
- The ten-business-day clock starts when the RAO receives the request; the law permits up to 15 additional business days for complex requests if the RAO notifies you.
- If they respond quickly with all the minutes, land the PDFs in `data/minutes/fincom/{YYYY-MM-DD}.pdf` and run:
  ```
  node scripts/minutes/extract_text.mjs
  node scripts/minutes/verify_corpus.mjs
  ```
  The extraction pipeline will handle them; you'll need to add the rows to the manifest manually or write a small ingest script.
- If they push back on scope, the natural narrow-downs are (in order of priority): FY24 to present, then FY22-FY23, then FY19-FY21.
- If they provide minutes in a paper-only format, document that in the manifest `notes` field and scan locally; OCR fallback in the pipeline will handle scanned PDFs.
