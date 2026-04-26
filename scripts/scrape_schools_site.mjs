#!/usr/bin/env node
// Scrape PDFs from marbleheadschools.org, cache locally (gitignored), and
// commit text extractions plus a manifest. Re-runnable: skip-if-exists.
//
// Layout:
//   data/schools/_pdfs/<category>/<slug>.pdf   (gitignored)
//   data/schools/<category>/<slug>.txt          (committed)
//   data/schools/manifest.json                  (committed)
//
// Run: node scripts/scrape_schools_site.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pLimit from 'p-limit';

const ROOT = resolve('data/schools');
const PDF_ROOT = resolve(ROOT, '_pdfs');
const MANIFEST = resolve(ROOT, 'manifest.json');
const CONCURRENCY = 3;
const TIMEOUT_MS = 240_000;
const TODAY = new Date().toISOString().slice(0, 10);

// Category | doc_date | title | source_url
// doc_date is YYYY-MM-DD when known, otherwise a year/range or empty.
const INVENTORY = [
  // ── Union contracts (Unit Contracts page) ──────────────────────────────
  ['contracts', '2024', 'Public Employee Committee Health Agreement', 'https://resources.finalsite.net/images/v1741689707/marbleheadschoolsorg/iktbrwp8vu4nniyetafm/public_employee_committee_health_agreement.pdf'],
  ['contracts', '2024-2025', 'Unit A 2024-2025', 'https://resources.finalsite.net/images/v1758894855/marbleheadschoolsorg/rnqhssgwoebfzmua5oqq/Unit_A_2024-2025.pdf'],
  ['contracts', '2021-2024', 'Unit A 2021-2024', 'https://resources.finalsite.net/images/v1741690358/marbleheadschoolsorg/m9ybwueu1kaz4dftzj8p/Unit_A_2021-2024.pdf'],
  ['contracts', '2024-2025', 'Unit A 1-Year MOA 2024-2025', 'https://resources.finalsite.net/images/v1741690359/marbleheadschoolsorg/qibd4dosvu5ngk1edoep/Unit_A-1-Year_MOA_2024-2025.pdf'],
  ['contracts', '2025-2028', 'Unit A 3-Year MOA 2025-2028', 'https://resources.finalsite.net/images/v1741690361/marbleheadschoolsorg/ohtrtg1c0txyk2hfyjcf/Unit_A_-3-Year_MOA_2025-2028.pdf'],
  ['contracts', '2025-2028', 'Instructional Assistants 2025-2028', 'https://resources.finalsite.net/images/v1758895034/marbleheadschoolsorg/pe9eyy5ks1aedamdchcp/Instructional_Assistants-2025-2028-signed.pdf'],
  ['contracts', '2021-2024', 'Tutors 2021-2024', 'https://resources.finalsite.net/images/v1741690361/marbleheadschoolsorg/arcotna3iwxtyg9bduyt/Tutors_2021-2024.pdf'],
  ['contracts', '2024-2025', 'Tutors 1-Year MOA 2024-2025', 'https://resources.finalsite.net/images/v1741690362/marbleheadschoolsorg/z0t4iuzpgsxqzu3tj4tz/Tutors-1-Year_MOA_2024-2025.pdf'],
  ['contracts', '2025-2028', 'Tutors 3-Year MOA 2025-2028', 'https://resources.finalsite.net/images/v1741690363/marbleheadschoolsorg/tp8yj2qgkq5ztgapbjec/Tutors-3-Year_MOA_2025-2028.pdf'],
  ['contracts', '2021-2024', 'Paraprofessional 2021-2024', 'https://resources.finalsite.net/images/v1741690365/marbleheadschoolsorg/ykpkros9p1acho55x0kq/Paraprofessional_2021-2024.pdf'],
  ['contracts', '2024-2025', 'Paraprofessional 1-Year MOA 2024-2025', 'https://resources.finalsite.net/images/v1741690366/marbleheadschoolsorg/c2iy2vbvqihsuitz3e22/Paraprofessional-1-Year_MOA_2024-2025.pdf'],
  ['contracts', '2025-2028', 'Paraprofessional 3-Year MOA 2025-2028', 'https://resources.finalsite.net/images/v1741690367/marbleheadschoolsorg/bpnp9kkd6wtklxhuffin/Paraprofessional-3-Year_MOA_2025-2028.pdf'],
  ['contracts', '2025-2028', 'Operational Support Personnel 2025-2028', 'https://resources.finalsite.net/images/v1758895412/marbleheadschoolsorg/ntauiszblkyybpik9h6q/Operational_Support_Personnel_2025-2028.pdf'],
  ['contracts', '2025-2028', 'Custodian 3-Year 2025-2028', 'https://resources.finalsite.net/images/v1758895172/marbleheadschoolsorg/u6iy1mfstdbk6d5lkkft/Custodian-3-Year_2025-2028.pdf'],
  ['contracts', '2021-2024', 'Custodian 2021-2024', 'https://resources.finalsite.net/images/v1741690371/marbleheadschoolsorg/yh1x3xqeg7m1ysormu8b/Custodian_2021-2024.pdf'],
  ['contracts', '2024-2025', 'Custodian 1-Year MOA 2024-2025', 'https://resources.finalsite.net/images/v1741690372/marbleheadschoolsorg/egfpfztfir5vmfjh0spf/Custodian-1-Year_MOA_2024-2025.pdf'],
  ['contracts', '2025-2028', 'Custodian 3-Year MOA 2025-2028', 'https://resources.finalsite.net/images/v1741690373/marbleheadschoolsorg/imdjxi6pn2xyuohqakq1/Custodian-3-Year_MOA_2025-2028.pdf'],
  ['contracts', '2025-2028', 'Permanent Substitute 3-Year 2025-2028', 'https://resources.finalsite.net/images/v1758895266/marbleheadschoolsorg/gavpbk1hspmqo24muk8g/Permanent_Substitute-3-Year_2025-2028.pdf'],
  ['contracts', '2021-2024', 'Permanent Substitutes 2021-2024', 'https://resources.finalsite.net/images/v1741690368/marbleheadschoolsorg/tbzfrn61hgezoifpnl9r/Permanent_Substitutes_2021-2024.pdf'],
  ['contracts', '2024-2025', 'Permanent Substitute 1-Year MOA 2024-2025', 'https://resources.finalsite.net/images/v1741690369/marbleheadschoolsorg/yck0tdyj8klbric4jqnw/Permanent_Substitute-1-Year_MOA_2024-2025.pdf'],
  ['contracts', '2025-2028', 'Permanent Substitute 3-Year MOA 2025-2028', 'https://resources.finalsite.net/images/v1741690370/marbleheadschoolsorg/elabiberydchxqgnmkqh/Permanent_Substitute-3-Year_MOA_2025-2028.pdf'],

  // ── Superintendent (contract, evaluation, goals) ────────────────────────
  ['superintendent', '', 'John Robidoux Contract', 'https://resources.finalsite.net/images/v1762954488/marbleheadschoolsorg/cfyhrywuk9as7jp9rder/JohnRobidouxContract.pdf'],
  ['superintendent', '', 'Superintendent Evaluation Report', 'https://resources.finalsite.net/images/v1762954713/marbleheadschoolsorg/qfgg1d2hlhdg6gbjrsxo/SuperintendentEval.pdf'],
  ['superintendent', '2025-2027', 'Goal 1 Professional Practice 2025-2027', 'https://resources.finalsite.net/images/v1763739370/marbleheadschoolsorg/qwbhu0uh3vume1vpqv29/ProfessionalPracticeGoal25-27.pdf'],
  ['superintendent', '2025-2027', 'Goal 2 District Improvement 2025-2027', 'https://resources.finalsite.net/images/v1763739431/marbleheadschoolsorg/hjm5jcrbypsn4jfistao/DistrictImprovementGoal25-27.pdf'],
  ['superintendent', '2025-2027', 'Goal 3 District Improvement 2025-2027', 'https://resources.finalsite.net/images/v1763739582/marbleheadschoolsorg/drckr7np4pf4lcvd43dv/3DistrictImprovementGoal25-27.pdf'],
  ['superintendent', '2025-2027', 'Goal 4 Student Learning 2025-2027', 'https://resources.finalsite.net/images/v1763739625/marbleheadschoolsorg/gitlwiohrjtgkbpqec4c/4StudentLearningGoal25-27.pdf'],

  // ── School Committee goals (own goals, separate from Super) ─────────────
  ['sc-goals', '2025-2026', 'Data-Driven Decision-Making and Communication Goal', 'https://resources.finalsite.net/images/v1763998940/marbleheadschoolsorg/pfbcmzys6wgsabq7l7z0/Data-DrivenDecision-MakingandCommunicationGoal.pdf'],
  ['sc-goals', '2025-2026', 'Elevate Educator Voices Goal 2025-2026', 'https://resources.finalsite.net/images/v1763999025/marbleheadschoolsorg/nvanb5xknrlvwzxicqtk/ElevateEducatorVoicesGoal2025-2026.pdf'],
  ['sc-goals', '2025-2026', 'Financial Transparency of School Budget', 'https://resources.finalsite.net/images/v1763999056/marbleheadschoolsorg/ocf8xebpbc2bdi9b71zz/FinancialTransparencyofSchoolBudget.pdf'],
  ['sc-goals', '2025-2026', 'Strategic Planning Goal 2025-2026', 'https://resources.finalsite.net/images/v1763999089/marbleheadschoolsorg/ahkdpa7mz8barjcwbhbo/StrategicPlanningGoal2025-2026.pdf'],

  // ── Strategic Plan & Capital Facilities Plan ────────────────────────────
  ['strategic-plan', '2021-2026', 'Planning for Success 2021-2026', 'https://resources.finalsite.net/images/v1741690410/marbleheadschoolsorg/zabh4oz05dpmmpq8lbwz/Planning_for_Success_2021-2026.pdf'],
  ['capital-facilities', '', 'Capital Facilities Plan', 'https://resources.finalsite.net/images/v1741690835/marbleheadschoolsorg/apdgujai29xc5kwrlxsu/capital_facilities_plan.pdf'],

  // ── Negotiations Archive (2024 strike-era, ONE-SIDED — see INDEX) ───────
  ['negotiations-archive', '2024-11-23', 'Press Release 11.23.24 9PM', 'https://resources.finalsite.net/images/v1741690259/marbleheadschoolsorg/ryjtketl06t0hz1qzg7o/November_23_Evening.pdf'],
  ['negotiations-archive', '2024-11-23', 'Negotiations Updates 11-23-2024', 'https://resources.finalsite.net/images/v1741690260/marbleheadschoolsorg/rer4f2tmw3kmtovpzivm/Negotiations_Updates_11-23-2024.pdf'],
  ['negotiations-archive', '2024-11-22', 'Negotiations Updates Nov 22', 'https://resources.finalsite.net/images/v1741690261/marbleheadschoolsorg/mgt0emo73kvjs7iyi6nv/Negotiations_Updates__Nov_22.pdf'],
  ['negotiations-archive', '2024-11-21', 'School Committee Letter Nov 20', 'https://resources.finalsite.net/images/v1741690262/marbleheadschoolsorg/xjhxoedqdu4hwduqpmft/School_Committee_Letter_Nov_20.pdf'],
  ['negotiations-archive', '2024-11-20', 'School Committee Nov 19', 'https://resources.finalsite.net/images/v1741690263/marbleheadschoolsorg/pxjo6ghquurhgtyug1mj/School_Committee_Nov_19.pdf'],
  ['negotiations-archive', '2024-11-18', 'Letter to Marblehead Families 11-18-2024', 'https://resources.finalsite.net/images/v1741690264/marbleheadschoolsorg/oohwyqhynmve6ay8kre4/Letter_to_Marblehead_Families_11_18_2024.pdf'],
  ['negotiations-archive', '2024-11-17', 'Letter to Marblehead Families 11-17-2024', 'https://resources.finalsite.net/images/v1741690265/marbleheadschoolsorg/ntzyqlsbraqvq68c30we/Letter_to_Marblehead_Families_11_17_2024.pdf'],
  ['negotiations-archive', '2024-11-16', 'Press Release 11.16.24', 'https://resources.finalsite.net/images/v1741690266/marbleheadschoolsorg/zvsbqmdtcowy0mx1f7pb/111624.pdf'],
  ['negotiations-archive', '2024-11-13', 'Press Release 11.13.24', 'https://resources.finalsite.net/images/v1741690267/marbleheadschoolsorg/eaeu9gvvrh0hticuhxg9/111324.pdf'],
  ['negotiations-archive', '2024-11-13', 'Comparison of Proposals Fact Sheet 11.13.24', 'https://resources.finalsite.net/images/v1741690268/marbleheadschoolsorg/yr2cvyacjbmtw2esg06m/Marblehead_School_Committee_Fact_Sheet.pdf'],
  ['negotiations-archive', '2024-11-12', 'School Closure 11-13-24', 'https://resources.finalsite.net/images/v1741690269/marbleheadschoolsorg/kh8nlfjqxzkgaccqwp0d/MSC_SCHOOL_CLOSURE_11-13-24docx.pdf'],
  ['negotiations-archive', '2024-11-12', 'Press Conference Statement 11.12.24', 'https://resources.finalsite.net/images/v1741690270/marbleheadschoolsorg/otnmlvqu2u2jf5h5p3lj/MSC_Press_Conference_Statement_11224.pdf'],
  ['negotiations-archive', '2024-11-11', 'School Committee Statement 11.11.24', 'https://resources.finalsite.net/images/v1741690271/marbleheadschoolsorg/m7qfxvudaisaghmy0mxc/Marblehead_School_Committee_Statement111124.pdf'],
  ['negotiations-archive', '2024-11-04', 'Press Release 11.04.24', 'https://resources.finalsite.net/images/v1741690272/marbleheadschoolsorg/jhz7p0yicpml74syn0ec/11424.pdf'],
  ['negotiations-archive', '2024-10-28', 'Press Release 10.28.24', 'https://resources.finalsite.net/images/v1741690273/marbleheadschoolsorg/emggc9tia18rudsuzb7h/102824.pdf'],
  ['negotiations-archive', '2024-10-21', 'Press Release 10.21.24', 'https://resources.finalsite.net/images/v1741690274/marbleheadschoolsorg/ze1ybxemxfna6kaokrx2/102124.pdf'],
  ['negotiations-archive', '2024-10-17', 'Press Release 10.17.24', 'https://resources.finalsite.net/images/v1741690275/marbleheadschoolsorg/x0foh9fmmcsjltuf8wii/101724.pdf'],
  ['negotiations-archive', '2024-10-08', 'Press Release 10.08.24', 'https://resources.finalsite.net/images/v1741690276/marbleheadschoolsorg/wou5gr51sucvsslbxlgc/10824.pdf'],
  ['negotiations-archive', '2024-10-01', 'Press Release 10.01.24', 'https://resources.finalsite.net/images/v1741690277/marbleheadschoolsorg/sf5q6q4gk5obnq3cwzto/10124.pdf'],
  ['negotiations-archive', '2024-09-23', 'Press Release 9.23.24', 'https://resources.finalsite.net/images/v1741690278/marbleheadschoolsorg/g49crhuootlba4xlvwm6/92324.pdf'],
  ['negotiations-archive', '2024-09-10', 'Committee on School Safety 9.10.24', 'https://resources.finalsite.net/images/v1741690279/marbleheadschoolsorg/cn9unmxmmnmayzj0n3us/91024_safety.pdf'],
  ['negotiations-archive', '2024-09-10', 'Press Release 9.10.24', 'https://resources.finalsite.net/images/v1741690280/marbleheadschoolsorg/fz7qczicbehncpjoqq21/91024.pdf'],
  ['negotiations-archive', '2024-07-16', 'Press Release 7.16.24', 'https://resources.finalsite.net/images/v1741690281/marbleheadschoolsorg/mumiwd3xexlplo3vdurv/71624.pdf'],
  ['negotiations-archive', '2024-06-03', 'Press Release 6.3.24', 'https://resources.finalsite.net/images/v1741690282/marbleheadschoolsorg/xcpmyzg4ltkkkmkq8php/6-3-24_Press_Release.pdf'],
  ['negotiations-archive', '2024-10-17', 'Update on Negotiations with the MEA 10-17-2024', 'https://resources.finalsite.net/images/v1741690356/marbleheadschoolsorg/vmmptfv03lnbaxz9rtwb/Update_on_School_Committee__Negotiations_with_the_MEA.pdf'],
  ['negotiations-archive', '2024-09-19', 'Collective Bargaining Update 9-19-2024', 'https://resources.finalsite.net/images/v1741690357/marbleheadschoolsorg/qy6m7xqvgnvsqf1ugn5s/Presentation_91924.pdf'],

  // ── SC Negotiations: package proposals + salary scale ───────────────────
  ['sc-proposals', '2024-11-24', 'Unit A Salary Grid SC Offer Version 2', 'https://resources.finalsite.net/images/v1741690444/marbleheadschoolsorg/rpe1onmfrmkpetivfm2p/112424_Version_2_SC_offer_with_UNIT_A_Changes.pdf'],
  ['sc-proposals', '2024', '1-Year Successor Contract Proposal', 'https://resources.finalsite.net/images/v1741690448/marbleheadschoolsorg/gugak05tbrztxwplxdps/1-year_Successor_Contract.pdf'],

  // ── SC meeting packets, agendas, minutes (FY26) ─────────────────────────
  ['sc-meetings-fy26', '2026-04-09', 'Agenda and Materials 4.9.2026', 'https://resources.finalsite.net/images/v1775757812/marbleheadschoolsorg/fjmowv6yc1jdqsxbqjq2/fullpacket4926.pdf'],
  ['sc-meetings-fy26', '2026-03-27', 'Agenda and Materials 3.27.2026', 'https://resources.finalsite.net/images/v1774611897/marbleheadschoolsorg/xiwoaipauufeqxo9barn/sc327packet.pdf'],
  ['sc-meetings-fy26', '2026-03-19', 'Agenda and Materials 3.19.2026', 'https://resources.finalsite.net/images/v1773944384/marbleheadschoolsorg/jvdgr6lyn1uvcwx1pnd4/completescpacket319.pdf'],
  ['sc-meetings-fy26', '2026-03-12', 'Agenda and Materials 3.12.2026', 'https://resources.finalsite.net/images/v1773142825/marbleheadschoolsorg/qnjge2ijc3wzbmifiz3q/scagenda312.pdf'],
  ['sc-meetings-fy26', '2026-03-05', 'Agenda and Materials 3.5.2026', 'https://resources.finalsite.net/images/v1772739555/marbleheadschoolsorg/kdzas4eyl5titfxlmfqh/packet35.pdf'],
  ['sc-meetings-fy26', '2026-02-26', 'Agenda and Materials 2.26.2026', 'https://resources.finalsite.net/images/v1772132086/marbleheadschoolsorg/tkhb9aymd6lz8nv97k9g/226scpacket.pdf'],
  ['sc-meetings-fy26', '2026-02-05', 'Agenda and Materials 2.5.2026 (FY27 Budget Packet)', 'https://resources.finalsite.net/images/v1770394283/marbleheadschoolsorg/abvvnuezygg1rsgil17k/2026Budgetpacket.pdf'],
  ['sc-meetings-fy26', '2026-01-29', 'Agenda and Materials 1.29.2026', 'https://resources.finalsite.net/images/v1769713387/marbleheadschoolsorg/cihz2sk4snm5sq8nncqm/12926scpacket.pdf'],
  ['sc-meetings-fy26', '2026-01-15', 'Agenda and Materials 1.15.2026', 'https://resources.finalsite.net/images/v1768504813/marbleheadschoolsorg/zoeefsql6c05uyoa88yi/1152026packet.pdf'],
  ['sc-meetings-fy26', '2026-01-05', 'Executive Session Agenda 1.5.2026', 'https://resources.finalsite.net/images/v1767628062/marbleheadschoolsorg/pb9wkpzzr8eodp64k9vq/scexecutivesession1526.pdf'],
  ['sc-meetings-fy26', '2025-12-18', 'Agenda and Materials 12.18.2025', 'https://resources.finalsite.net/images/v1766087038/marbleheadschoolsorg/ynhccnkzpgpv0fxhbwhy/121825packet.pdf'],
  ['sc-meetings-fy26', '2025-12-04', 'Agenda and Materials 12.04.2025', 'https://resources.finalsite.net/images/v1764875488/marbleheadschoolsorg/pu5wrizzctnhlcuhviz3/12042025AgendaMaterialspdf.pdf'],
  ['sc-meetings-fy26', '2025-11-20', 'Agenda and Materials 11.20.2025', 'https://resources.finalsite.net/images/v1763573987/marbleheadschoolsorg/piwigdp0w3jirw2o5q5k/sc_agenda_1120.pdf'],
  ['sc-meetings-fy26', '2025-11-06', 'Agenda and Materials 11.6.2025', 'https://resources.finalsite.net/images/v1762373205/marbleheadschoolsorg/un5rur6sqgyay1oxqbyd/1162025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-10-30', 'Agenda and Materials 10.30.2025', 'https://resources.finalsite.net/images/v1762373111/marbleheadschoolsorg/utf4tdxsw6apognykq84/10302025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-10-29', 'Agenda and Materials 10.29.2025', 'https://resources.finalsite.net/images/v1762373053/marbleheadschoolsorg/hcliautjou87lfmmtoji/10292025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-10-15', 'Agenda and Materials 10.15.2025', 'https://resources.finalsite.net/images/v1762372991/marbleheadschoolsorg/wo9kg5htlbaut8qselln/10152025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-09-30', 'Agenda and Materials 9.30.2025', 'https://resources.finalsite.net/images/v1762372767/marbleheadschoolsorg/jjxqhfpifyeicwudmgas/9302025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-09-18', 'Agenda and Materials 9.18.2025', 'https://resources.finalsite.net/images/v1758896930/marbleheadschoolsorg/j3eyibcmbiuk33qxtpcb/9182025_Agenda_Materials.pdf'],
  ['sc-meetings-fy26', '2025-09-12', 'Agenda 9.12.2025', 'https://resources.finalsite.net/images/v1758896487/marbleheadschoolsorg/hyoocmlciihokvsnaggg/9122025_Agenda.pdf'],
  ['sc-meetings-fy26', '2025-09-04', 'Agenda and Materials 9.4.2025', 'https://resources.finalsite.net/images/v1758896333/marbleheadschoolsorg/orl6sa3r7dkpl0grtrx1/942025_Agenda_Materials.pdf'],
  ['sc-meetings-fy26', '2025-08-21', 'Agenda and Materials 8.21.2025', 'https://resources.finalsite.net/images/v1755805232/marbleheadschoolsorg/n8r7thtthsyitt82l2ef/8212025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-08-04', 'Agenda and Materials 8.4.2025', 'https://resources.finalsite.net/images/v1755805195/marbleheadschoolsorg/klcwrjy7zbl12wm9grpy/842025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-07-31', 'Agenda and Materials 7.31.2025', 'https://resources.finalsite.net/images/v1755805156/marbleheadschoolsorg/boko8szqrsae7v8wfrnb/7312025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2025-07-02', 'Agenda and Materials 7.2.2025', 'https://resources.finalsite.net/images/v1755804987/marbleheadschoolsorg/h3qjpgw0sqfmzvn1ggo3/722025AgendaMaterials.pdf'],
  ['sc-meetings-fy26', '2026-02-13', 'Facilities Subcommittee Minutes 2.13.2026', 'https://resources.finalsite.net/images/v1773772039/marbleheadschoolsorg/mnbn4dk4tvqwsj3bhuzb/SCminutes-2_13_26FacilitiesSubcommittee1.pdf'],
  ['sc-meetings-fy26', '2026-01-15', 'Minutes 1.15.2026', 'https://resources.finalsite.net/images/v1770322343/marbleheadschoolsorg/uhwmekcbbtnxsk0brxbh/SchoolCommitteeMinutes1-15-26.pdf'],
  ['sc-meetings-fy26', '2026-01-06', 'Budget Subcommittee Minutes 1.6.2026', 'https://resources.finalsite.net/images/v1769778839/marbleheadschoolsorg/mn2aa25s9dtc0v5f4scx/1_6_26approvedTBudgetSubcommitteeMinutes.pdf'],
  ['sc-meetings-fy26', '2025-12-18', 'Minutes 12.18.2025', 'https://resources.finalsite.net/images/v1770324291/marbleheadschoolsorg/es9os9umqrksuvwdn2pe/SchoolCommitteeMinutes12-18-25.pdf'],
  ['sc-meetings-fy26', '2025-12-01', 'Budget Subcommittee Minutes 12.1.2025', 'https://resources.finalsite.net/images/v1769002679/marbleheadschoolsorg/x3ylgnayv08r92qdqjmv/12_1_25BudgetSubcommitteeMinutes.pdf'],
  ['sc-meetings-fy26', '2025-11-20', 'Minutes 11.20.2025', 'https://resources.finalsite.net/images/v1770324261/marbleheadschoolsorg/rrmisjskju5il3i6pyyz/SchoolCommitteeMinutes11-20-25.pdf'],
  ['sc-meetings-fy26', '2025-11-20', 'Policy Subcommittee Minutes 11.20.2025', 'https://resources.finalsite.net/images/v1770042503/marbleheadschoolsorg/ie5fetx4ypxgq6trmnyd/11_20_25PolicyMinutes1docx.pdf'],
  ['sc-meetings-fy26', '2025-11-06', 'Minutes 11.6.2025', 'https://resources.finalsite.net/images/v1770324212/marbleheadschoolsorg/hbrhsxcenhkwr9bipzo5/SchoolCommitteeMinutes11-6-25.pdf'],
  ['sc-meetings-fy26', '2025-11-05', 'Facilities Subcommittee Minutes 11.05.2025', 'https://resources.finalsite.net/images/v1773772163/marbleheadschoolsorg/bxdxwyev0ltqknovdyyz/SCminutes-11_5_25FacilitiesSubcommittee1.pdf'],
  ['sc-meetings-fy26', '2025-11-17', 'Budget Subcommittee Minutes 11.17.2025', 'https://resources.finalsite.net/images/v1769002679/marbleheadschoolsorg/xjocfikhsyur6zbdxnw8/111725BudgetSubcomitteeminutes.pdf'],
  ['sc-meetings-fy26', '2025-10-30', 'Minutes 10.30.2025', 'https://resources.finalsite.net/images/v1770324172/marbleheadschoolsorg/evycuh3jtirjbl9bukqz/SchoolCommitteeMinutes10-30-25.pdf'],
  ['sc-meetings-fy26', '2025-10-30', 'Budget Subcommittee Minutes 10.30.2025', 'https://resources.finalsite.net/images/v1769002679/marbleheadschoolsorg/kbl2aea6svobdrma6sne/10_30_25BudgetSubcomitteeminutes.pdf'],
  ['sc-meetings-fy26', '2025-10-23', 'Policy Subcommittee Minutes 10.23.2025', 'https://resources.finalsite.net/images/v1770042920/marbleheadschoolsorg/zbgqaey4ava0gwpace4h/DRAFT10_23_23PolicyMinutesdocx1_1.pdf'],
  ['sc-meetings-fy26', '2025-10-17', 'Budget Subcommittee Minutes 10.17.2025', 'https://resources.finalsite.net/images/v1769002679/marbleheadschoolsorg/pksykueonhbimoflh5ex/10_17_25BudgetSubcommitteeMinutes.pdf'],
  ['sc-meetings-fy26', '2025-10-15', 'Minutes 10.15.2025', 'https://resources.finalsite.net/images/v1770324131/marbleheadschoolsorg/lsbhfrfli8f52uh7zuqp/SchoolCommitteeMinutes10-15-30.pdf'],
  ['sc-meetings-fy26', '2025-09-30', 'Minutes 9.30.2025', 'https://resources.finalsite.net/images/v1770323522/marbleheadschoolsorg/yvydgovonnntedmnz6cy/SchoolCommitteeMinutes9-30-25.pdf'],
  ['sc-meetings-fy26', '2025-09-30', 'Policy Subcommittee Minutes 9.30.2025', 'https://resources.finalsite.net/images/v1770042454/marbleheadschoolsorg/pquzv4zdqo031m8xieuf/9_30policysubcommitteeminutes.pdf'],
  ['sc-meetings-fy26', '2025-09-18', 'Minutes 9.18.2025', 'https://resources.finalsite.net/images/v1770323462/marbleheadschoolsorg/xp2crvmjyzhscor7jk2j/SchoolCommitteeMinutes9-18-25.pdf'],
  ['sc-meetings-fy26', '2025-09-04', 'Minutes 9.4.2025', 'https://resources.finalsite.net/images/v1770323369/marbleheadschoolsorg/yfe2zijx8ngqxalgoftz/SchoolCommitteeMinutes9-4-25.pdf'],
  ['sc-meetings-fy26', '2025-09-05', 'Facilities Subcommittee Minutes 9.5.2025', 'https://resources.finalsite.net/images/v1773772099/marbleheadschoolsorg/rdnoutavzafjvtswgehp/SCminutes-9_5_25FacilitiesSubcommittee1.pdf'],
  ['sc-meetings-fy26', '2025-08-28', 'Policy Subcommittee Minutes 8.28.2025', 'https://resources.finalsite.net/images/v1770042349/marbleheadschoolsorg/mwmmshjxiymvqp6cqtz3/MSCPolicySubcomittee8_28_25docx.pdf'],
  ['sc-meetings-fy26', '2025-08-21', 'Minutes 8.21.2025', 'https://resources.finalsite.net/images/v1758897074/marbleheadschoolsorg/ptivpbnanyb7zykpbd6v/8212025_Minutes.pdf'],
  ['sc-meetings-fy26', '2025-08-04', 'Minutes 8.4.2025', 'https://resources.finalsite.net/images/v1758896988/marbleheadschoolsorg/txmuvpbj4fvwqlrnkt57/842025_Minutes.pdf'],
  ['sc-meetings-fy26', '2025-07-31', 'Minutes 7.31.2025', 'https://resources.finalsite.net/images/v1770324085/marbleheadschoolsorg/ululjh3s1q0dehql4p8b/SchoolCommitteeMinutes7-31-25.pdf'],
  ['sc-meetings-fy26', '2025-07-24', 'Facilities Subcommittee Minutes 7.24.2025', 'https://resources.finalsite.net/images/v1773771966/marbleheadschoolsorg/mu7arqhkjquayxneajte/72425facsubminutes.pdf'],
  ['sc-meetings-fy26', '2025-07-02', 'Minutes 7.2.2025', 'https://resources.finalsite.net/images/v1770322881/marbleheadschoolsorg/jke5ltolwdauqczglk1o/SchoolCommitteeMinutes7-2-25.pdf'],
  ['sc-meetings-fy26', '2026-03-25', 'Budget Subcommittee 3.25.2026', 'https://resources.finalsite.net/images/v1774444726/marbleheadschoolsorg/ypjbbltzgkthe3tugv4s/32526budgetsub.pdf'],
  ['sc-meetings-fy26', '2026-03-16', 'Facilities Subcommittee 3.16.2026', 'https://resources.finalsite.net/images/v1773671541/marbleheadschoolsorg/ckoitmvctcebioohf9rm/316facsub.pdf'],
  ['sc-meetings-fy26', '2026-02-13', 'Goals Subcommittee 2.13.2026', 'https://resources.finalsite.net/images/v1770915538/marbleheadschoolsorg/ubmldrggw8zlintinox4/213goalssubcommittee.pdf'],
  ['sc-meetings-fy26', '2026-01-22', 'Policy Subcommittee 1.22.2026', 'https://resources.finalsite.net/images/v1769001660/marbleheadschoolsorg/iku0dzf6ozphboglgtmd/policysub12226.pdf'],
  ['sc-meetings-fy26', '2026-01-05', 'Budget Subcommittee 1.5.2026', 'https://resources.finalsite.net/images/v1767628163/marbleheadschoolsorg/szudcc2n0l4vkgnucdyy/busgetsubcommittee.pdf'],
  ['sc-meetings-fy26', '2025-11-20', 'Policy Subcommittee 11.20.2025', 'https://resources.finalsite.net/images/v1763573859/marbleheadschoolsorg/gcqzuzb93h4bb4ilyu9w/policy_sub_1120.pdf'],
  ['sc-meetings-fy26', '2025-11-05', 'Facilities Subcommittee 11.5.2025', 'https://resources.finalsite.net/images/v1762373466/marbleheadschoolsorg/enobfs3qxh6da6weszhb/1152025FacilitiesSub.pdf'],
  ['sc-meetings-fy26', '2025-10-30', 'SC Budget Sub. and Finance Committee Schools Joint 10.30.2025', 'https://resources.finalsite.net/images/v1762373412/marbleheadschoolsorg/ztociyxp5gwnt4rhbfku/103025MarbleheadSchoolCommitteeBudgetSubandMarbleheadFinanceCommitteeSchools.pdf'],
  ['sc-meetings-fy26', '2025-10-23', 'Policy Subcommittee 10.23.2025', 'https://resources.finalsite.net/images/v1762373369/marbleheadschoolsorg/j0wluuus7tamrhvtotbi/10232025PolicySub.pdf'],
  ['sc-meetings-fy26', '2025-10-17', 'SC Budget Sub. and Finance Committee Schools Joint 10.17.2025', 'https://resources.finalsite.net/images/v1762373316/marbleheadschoolsorg/orcaneesnrdyro8jocks/10172025MarbleheadSchoolCommitteeBudgetSubandMarbleheadFinanceCommitteeSchools.pdf'],
  ['sc-meetings-fy26', '2025-09-30', 'Policy Subcommittee 9.30.2025', 'https://resources.finalsite.net/images/v1762373280/marbleheadschoolsorg/zmlgvxkgamhrwdjbrzgt/930202PolicySub.pdf'],
  ['sc-meetings-fy26', '2025-09-05', 'Facilities Subcommittee 9.5.2025', 'https://resources.finalsite.net/images/v1758897133/marbleheadschoolsorg/mnpa6mtfidx138emdetf/952025_FacilitiesSub.pdf'],
  ['sc-meetings-fy26', '2025-07-24', 'Facilities Subcommittee 7.24.2025', 'https://resources.finalsite.net/images/v1755805292/marbleheadschoolsorg/yjmintjie2s5jm81vvz9/7242025FacilitiesSub.pdf'],
];

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function rowKey(row) {
  return `${row.category}/${row.slug}`;
}

function buildRows() {
  const seen = new Map();
  return INVENTORY.map(([category, doc_date, title, source_url]) => {
    let slug = slugify(title);
    let attempt = slug;
    let n = 2;
    while (seen.has(`${category}/${attempt}`)) {
      attempt = `${slug}-${n++}`;
    }
    seen.set(`${category}/${attempt}`, true);
    return { category, doc_date, title, source_url, slug: attempt };
  });
}

async function downloadPdf(row) {
  const pdfPath = resolve(PDF_ROOT, row.category, `${row.slug}.pdf`);
  if (existsSync(pdfPath) && statSync(pdfPath).size > 0) {
    return { ok: true, pdfPath, cached: true };
  }
  mkdirSync(dirname(pdfPath), { recursive: true });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(row.source_url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'marbleheaddata.org research scraper (agbaber@gmail.com)' },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) {
      return { ok: false, error: `suspiciously small (${buf.length} bytes)` };
    }
    writeFileSync(pdfPath, buf);
    return { ok: true, pdfPath, cached: false };
  } catch (err) {
    return { ok: false, error: `fetch: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

// PDFs whose pdftotext output is below this byte threshold are treated as
// scanned/image-only and routed through OCR.
const SCANNED_BYTE_THRESHOLD = 100;

function extractText(pdfPath, txtPath) {
  if (existsSync(txtPath) && statSync(txtPath).size >= SCANNED_BYTE_THRESHOLD) {
    return { ok: true, cached: true, method: 'cached' };
  }
  mkdirSync(dirname(txtPath), { recursive: true });
  try {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, txtPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (err) {
    return { ok: false, error: `pdftotext: ${err.message}` };
  }
  const size = existsSync(txtPath) ? statSync(txtPath).size : 0;
  if (size >= SCANNED_BYTE_THRESHOLD) {
    return { ok: true, cached: false, method: 'pdftotext' };
  }
  // Likely scanned — run OCR. ocrmypdf rewrites the PDF in place with a text
  // layer and writes a sidecar txt file. --redo-ocr safely retries even if a
  // page already had garbage text.
  try {
    execFileSync('ocrmypdf', [
      '--quiet',
      '--redo-ocr',
      '--optimize', '0',
      '--tesseract-timeout', '300',
      '--jobs', '1',
      '--sidecar', txtPath,
      pdfPath,
      pdfPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    return { ok: false, error: `ocrmypdf: ${err.message?.split('\n')[0] ?? err}` };
  }
  const ocrSize = existsSync(txtPath) ? statSync(txtPath).size : 0;
  if (ocrSize < SCANNED_BYTE_THRESHOLD) {
    return { ok: false, error: `OCR produced minimal text (${ocrSize} bytes)` };
  }
  return { ok: true, cached: false, method: 'ocr' };
}

async function processRow(row) {
  const dl = await downloadPdf(row);
  if (!dl.ok) {
    return { ...row, status: 'download_failed', error: dl.error, retrieved_date: TODAY };
  }
  const txtPath = resolve(ROOT, row.category, `${row.slug}.txt`);
  const ex = extractText(dl.pdfPath, txtPath);
  if (!ex.ok) {
    return { ...row, status: 'extract_failed', error: ex.error, retrieved_date: TODAY, local_pdf: `data/schools/_pdfs/${row.category}/${row.slug}.pdf` };
  }
  return {
    ...row,
    status: 'ok',
    extract_method: ex.method,
    retrieved_date: TODAY,
    local_pdf: `data/schools/_pdfs/${row.category}/${row.slug}.pdf`,
    local_text: `data/schools/${row.category}/${row.slug}.txt`,
    text_bytes: statSync(txtPath).size,
  };
}

const CATEGORY_META = {
  'contracts': {
    title: 'Union contracts',
    blurb: 'Collective bargaining agreements (Unit A teachers, paraprofessionals, instructional assistants, custodians, tutors, perm subs, operational support) plus the <abbr class="g" title="Group Insurance Commission">GIC</abbr> public-employee health agreement.',
  },
  'superintendent': {
    title: 'Superintendent',
    blurb: 'Robidoux contract, evaluation report, and 2025&ndash;2027 goals (4).',
  },
  'sc-goals': {
    title: 'School Committee 2025&ndash;2026 goals',
    blurb: 'The committee\'s own annual goals (separate from the superintendent\'s goals).',
  },
  'strategic-plan': {
    title: 'Strategic plan',
    blurb: 'Planning for Success 2021&ndash;2026.',
  },
  'capital-facilities': {
    title: 'Capital facilities plan',
    blurb: 'District capital plan.',
  },
  'negotiations-archive': {
    title: 'Negotiations archive (2024 contract dispute, ONE-SIDED)',
    blurb: '**One-sided source.** These are School Committee press releases and statements during the fall-2024 Unit A contract dispute. They are the SC\'s public position, not neutral reporting. Any citation must be paired with the MEA\'s contemporaneous statements or framed explicitly as the SC\'s position.',
  },
  'sc-proposals': {
    title: 'SC contract counter-proposals (2024)',
    blurb: 'School Committee\'s package proposals and proposed salary grids during the 2024 negotiations.',
  },
  'sc-meetings-fy26': {
    title: 'School Committee meetings, FY26',
    blurb: 'Agenda packets, minutes, and subcommittee minutes for July 2025 onward. Includes the FY27 Superintendent\'s Proposed Budget packet (2.5.2026 meeting).',
  },
};

function writeIndex(manifest) {
  const byCategory = new Map();
  for (const e of manifest.entries) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category).push(e);
  }
  // Sort entries within a category: by doc_date desc, falling back to title.
  for (const list of byCategory.values()) {
    list.sort((a, b) => {
      const da = a.doc_date ?? '';
      const db = b.doc_date ?? '';
      if (da !== db) return db.localeCompare(da);
      return a.title.localeCompare(b.title);
    });
  }
  const ocrCount = manifest.entries.filter(e => e.extract_method === 'ocr').length;
  const totalTextBytes = manifest.entries.reduce((n, e) => n + (e.text_bytes ?? 0), 0);

  const lines = [];
  lines.push('---');
  lines.push('title: Schools Site Document Index');
  lines.push('body_class: doc-page');
  lines.push('---');
  lines.push('');
  lines.push('# Marblehead Public Schools: Document Index');
  lines.push('');
  lines.push('Index of public documents downloaded from');
  lines.push('[marbleheadschools.org](https://www.marbleheadschools.org/) and converted to plain');
  lines.push('text for grep-ability. Original PDFs are NOT committed to the repo; only text');
  lines.push('extracts and this index are. The scraper at');
  lines.push('[`scripts/scrape_schools_site.mjs`](../../scripts/scrape_schools_site.mjs) is re-runnable.');
  lines.push('');
  lines.push(`**Last scraped:** ${manifest.generated.slice(0, 10)}. **${manifest.entries.length} documents** (${manifest.entries.length - ocrCount} native text, ${ocrCount} OCR\'d via Tesseract). Total committed text: ${(totalTextBytes / 1024).toFixed(0)} KB.`);
  lines.push('');
  lines.push('## Citation discipline');
  lines.push('');
  lines.push('Every text extract maps to a source URL in [`manifest.json`](manifest.json). When');
  lines.push('citing a number, include the source URL and document date. OCR\'d text in');
  lines.push('particular has artifacts and is **not authoritative**; the original PDF is. To');
  lines.push('verify a quote, refetch the source URL and read the original.');
  lines.push('');
  lines.push('## One-sided sources flagged');
  lines.push('');
  lines.push('The `negotiations-archive/` folder contains School Committee press releases and');
  lines.push('statements from the fall-2024 Unit A contract dispute. **These are the SC\'s public');
  lines.push('position, not neutral reporting.** Any citation drawn from that folder must be paired');
  lines.push('with the MEA\'s contemporaneous statements or framed explicitly as the SC\'s position.');
  lines.push('');
  lines.push('## Categories');
  lines.push('');
  for (const cat of Object.keys(CATEGORY_META)) {
    const meta = CATEGORY_META[cat];
    const entries = byCategory.get(cat) ?? [];
    if (!entries.length) continue;
    lines.push(`### ${meta.title} (${entries.length})`);
    lines.push('');
    lines.push(meta.blurb);
    lines.push('');
    lines.push('| Date | Title | Source PDF | Local text | Method |');
    lines.push('|------|-------|------------|------------|--------|');
    for (const e of entries) {
      const date = e.doc_date || 'n/a';
      const localTxt = e.local_text ? `[txt](${e.local_text.replace('data/schools/', '')})` : 'n/a';
      const method = e.extract_method === 'ocr' ? 'OCR' : 'native';
      lines.push(`| ${date} | ${e.title} | [pdf](${e.source_url}) | ${localTxt} | ${method} |`);
    }
    lines.push('');
  }
  writeFileSync(resolve(ROOT, 'INDEX.md'), lines.join('\n'));
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  const rows = buildRows();
  console.log(`Inventory: ${rows.length} entries across ${new Set(rows.map(r => r.category)).size} categories`);

  // Load previous manifest to preserve retrieved_date for cached files
  let prev = {};
  if (existsSync(MANIFEST)) {
    try {
      const prevList = JSON.parse(readFileSync(MANIFEST, 'utf8')).entries ?? [];
      for (const r of prevList) prev[rowKey(r)] = r;
    } catch (err) {
      console.warn(`Could not read previous manifest: ${err.message}`);
    }
  }

  const limit = pLimit(CONCURRENCY);
  let done = 0;
  const results = await Promise.all(rows.map(row => limit(async () => {
    const result = await processRow(row);
    if (result.status === 'ok') {
      const prevEntry = prev[rowKey(row)];
      if (prevEntry?.retrieved_date && prevEntry.local_text) {
        result.retrieved_date = prevEntry.retrieved_date;
      }
      // Preserve original extract_method: a cached re-run shouldn't mask the
      // fact that a file was originally OCR'd.
      if (result.extract_method === 'cached' && prevEntry?.extract_method && prevEntry.extract_method !== 'cached') {
        result.extract_method = prevEntry.extract_method;
      }
    }
    done++;
    if (done % 10 === 0 || done === rows.length) {
      console.log(`  ${done}/${rows.length}`);
    }
    return result;
  })));

  const summary = {
    ok: results.filter(r => r.status === 'ok').length,
    download_failed: results.filter(r => r.status === 'download_failed').length,
    extract_failed: results.filter(r => r.status === 'extract_failed').length,
  };

  const manifest = {
    generated: new Date().toISOString(),
    source_site: 'https://www.marbleheadschools.org/',
    summary,
    entries: results.sort((a, b) => (a.category + a.slug).localeCompare(b.category + b.slug)),
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  writeIndex(manifest);

  console.log(`\nFinal: ${summary.ok} ok, ${summary.download_failed} download_failed, ${summary.extract_failed} extract_failed`);
  if (summary.download_failed || summary.extract_failed) {
    console.log('\nFailures:');
    for (const r of results.filter(r => r.status !== 'ok')) {
      console.log(`  [${r.status}] ${r.category}/${r.slug}: ${r.error}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
