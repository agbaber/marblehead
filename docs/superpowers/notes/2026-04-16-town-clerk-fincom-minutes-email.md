# Draft email to Town Clerk re: Finance Committee minutes

**To:** clerk@marbleheadma.gov
**CC (optional):** finance@marbleheadma.gov (or whoever the current FinCom administrative contact is)
**Subject:** Public records request: Finance Committee meeting minutes, FY19 through present

---

Hello,

I'm a Marblehead resident working on a civic data project at marbleheaddata.org that compiles primary-source information on town fiscal history. I'm writing to ask about the availability of Finance Committee meeting minutes.

The town's Finance Committee documents page at marbleheadma.gov/category/finance-committee/ lists agendas and Annual Town Meeting reports, but I can't find published meeting minutes for regular FinCom meetings. A separate check of the Town Clerk's page didn't surface a FinCom minutes archive either.

Two questions:

1. Does the Finance Committee record and retain meeting minutes in the ordinary course (as contemplated by the Open Meeting Law, G.L. c. 30A, sec. 22)? If so, where are they filed, and is there a reason they aren't posted alongside the agendas on the town website?

2. If minutes exist but aren't posted publicly, could you point me to how I can request copies for the period FY19 (July 2018) through the present? Happy to submit a formal public records request under G.L. c. 66 if that's the right path. I'd accept electronic copies in whatever format is easiest for you to produce.

Happy to narrow the date range, scope to specific topics, or batch the request by fiscal year if that would reduce effort on your end. I'm not working on any legal or advocacy matter; the goal is a neutral, citable record of what the committee has discussed so residents can look up the context behind past fiscal decisions.

Thanks for your help.

Best,
Andrew Baber
agbaber@gmail.com
marbleheaddata.org

---

## Notes for Andrew when sending

- Sending from agbaber@gmail.com establishes the requester identity for any formal records request follow-up.
- The statute references (Open Meeting Law, G.L. c. 30A sec. 22, and public records law G.L. c. 66) flag that you know the ground rules without being adversarial. If they respond that "minutes don't exist," that's a meaningful finding in itself worth recording.
- If they answer with a portal or archive URL that wasn't linked from the main FinCom page, update `scripts/minutes/discover_fincom.mjs` to point at it and re-run discovery.
- If they produce minutes via email attachment, land the PDFs in `data/minutes/fincom/{YYYY-MM-DD}.pdf` and manually add rows to `data/minutes_manifest.csv`. The rest of the pipeline (`download_minutes.mjs` will no-op on rows where the file already exists; `extract_text.mjs` will pick them up).
