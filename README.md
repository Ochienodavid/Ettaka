# Ettaka – Land Rights Evidence Platform (Flutter Web + Firebase + Gemini)

**Every plot remembered. Every right protected.**

Ettaka turns undocumented, oral land holdings into tamper-evident digital evidence. Families record land deals by voice, map the boundary with a phone, add witnesses and photographs, and seal the record in a hash-chained ledger. Ettaka checks every new boundary against every recorded plot to catch double sales. Disputes move through a mediation pipeline with a complete evidence pack. Buyers, lenders, mediators and courts verify any record by scanning its QR code.

Built for the **Pre-DevFest Hackathon Kampala 2026**. Primary goal: SDG 16. Linked goals: SDGs 1, 2, 5, 8, 10, 15 and 17.

## Hackathon submission brief

### Problem

In Uganda and across Africa, land rights are often supported by oral agreements, witnesses, handwritten papers and locally understood boundaries rather than a single accessible digital record. When evidence is lost, altered or duplicated, families face land grabbing, double sales, exclusion of women from land decisions and disputes that are difficult to resolve. The people most affected are citizens, especially women and families relying on customary or informal tenure, while local leaders, mediators, lenders and courts need a dependable way to inspect the available evidence.

### Solution and user impact

Ettaka is a voice-first land rights evidence platform. A citizen can record a transaction in English or Luganda, capture the plot boundary, add parties, witnesses, consent evidence and photographs, then review and seal the record. The system compares the new boundary with existing plots and raises a live overlap warning before a potential double sale is completed. If a dispute arises, an LC1 official or mediator can move it through a tracked case workflow, schedule a session and preserve the evidence pack. A buyer, lender, mediator or court can scan a QR code or enter a record code to check authenticity, open disputes, boundary conflicts and the verification history.

 Ettaka is an evidence and accountability layer, not a replacement for an official land title. AI-generated text is reviewable before sealing, and legal guidance is clearly presented as informational.

### Judging-criteria alignment

| Criterion | How Ettaka meets it | Demonstrable evidence |
|---|---|---|
| **SDG Impact — 30%** | Directly addresses access to justice and accountable institutions under **SDG 16**, while supporting SDGs 1, 2, 5, 8, 10, 15 and 17. The product protects customary land evidence, improves women’s visibility in land records, and makes disputes and verification measurable. | Landing-page impact figures, SDG scorecard, gender and tenure reporting, dispute pipeline, audit trail and verification log. |
| **Use of Google Tools — 25%** | Flutter Web, Firebase Authentication/Firestore/Storage, Google Gemini and Google Maps Platform are used meaningfully across the client, identity, evidence, AI and mapping flows. | `flutter_app`, `google_generative_ai`, Firebase security rules, Gemini 2.5 Flash, the Voice Terms step, Old Papers digitization, Know My Rights assistant and Google Maps boundary provider. |
| **Technical Execution — 20%** | The core flow is implemented end to end: authenticate, create a record, capture evidence and boundary, detect overlaps, enforce consent blockers, draft an agreement, seal it, verify it publicly and route disputes to mediation. | Flutter Web record wizard, live overlap flags, Firebase-backed evidence model, SHA-256 fingerprints, QR verification and Ledger Explorer. |
| **Feasibility & Scale — 15%** | The Google Cloud-ready architecture uses Flutter Web for the client, Firebase Authentication/Firestore/Storage for managed application services, Gemini for AI workflows and Google Maps Platform for mapping. The existing Node/PostgreSQL API remains as a compatibility layer so current behavior is preserved during the migration. | `flutter_app`, Firebase security rules, Gemini service adapter, configurable environment variables, pagination, audit logging and documented production hardening. |
| **Pitch — 10%** | The three-minute demo follows a clear human story: protect a family kibanja, catch a double sale, complete a consent-aware record, verify it, demonstrate tamper detection and show the justice and SDG impact workflows. | The scripted demo below, seeded story records and public verification portal. |

### Google technologies used meaningfully

- **Google Gemini API via the Dart `google_generative_ai` package and Gemini 2.5 Flash:** transcribes recorded English/Luganda speech, translates and drafts bilingual agreements, reads photographed historical documents, extracts structured fields and answers rights questions using retrieved entries from Ettaka’s Ugandan legal library.
- **Google Maps Platform:** optionally renders satellite/street maps and supports location and boundary visualization when `VITE_GOOGLE_MAPS_API_KEY` is configured. OpenStreetMap and Esri imagery remain available as a provider fallback during development.
- **Flutter Web:** the migrated web client in [`flutter_app`](./flutter_app) preserves the existing product routes and user flows while providing a Google-supported cross-platform UI framework.
- **Firebase Authentication, Cloud Firestore and Cloud Storage:** provide the Google Cloud identity, records, evidence and file-storage services. Firestore rules keep evidence, seals and audit records append-only where required.
- **Google AI Studio:** provides the server-side `GEMINI_API_KEY`; secrets stay on the API server and are not exposed in the browser.

The existing Node/PostgreSQL service remains available as a behavioral compatibility backend while the Flutter Web client and Firebase service adapters are enabled. This preserves the current implementation during the stack migration instead of dropping features or changing the product’s workflows.

### Visual assets

The public-facing experience uses locally bundled Uganda-context photographs for community, land, mapping, evidence and mediation imagery. They are presentation assets only; user-uploaded identity and evidence photographs remain separate, access-controlled application data.

### Image attribution

The Uganda-context photographs in `client/public/images/` are Wikimedia Commons thumbnails and remain bundled locally for reliable hosting:

- `community-land.jpg`: [Rakiga women from the village of Rushaga in Uganda dance](https://commons.wikimedia.org/wiki/File:Rakiga_women_from_the_village_of_Rushaga_in_Uganda_dance_in_the_village%27s_tourist_center_(1).jpg), by Hanay, CC BY-SA 3.0
- `mediation.jpg`: [Wikimedia Community User Group Uganda strategy meeting](https://commons.wikimedia.org/wiki/File:Wikimedia_Community_User_Group_Uganda_Strategy_meeting_01.jpg), by NANTUMBWEJ, CC0
- `mapping-phone.jpg`: [A farmer in Doho rice scheme](https://commons.wikimedia.org/wiki/File:A_farmer_in_Doho_rice_scheme.jpg), by Haumbaeric, CC BY-SA 4.0
- `document-evidence.jpg`: [A farmer with harvested tomatoes](https://commons.wikimedia.org/wiki/File:A_farmer_with_harvested_tomatoes.jpg), by Emmanuel Ssekaggo, CC BY-SA 4.0

Please retain the source-page licensing and author information when redistributing the bundled assets.

| Layer | Technology |
|---|---|
| **Flutter Web** | Web client: responsive shell, route navigation, dashboards, land records, evidence workflows, disputes, verification, ledger and reports |
| **Firebase Authentication** | Managed identity and authenticated web sessions |
| **Cloud Firestore** | Cloud record, party, witness, evidence, dispute and audit data with security rules |
| **Cloud Storage** | Evidence files, identity photographs, document uploads and media retention |
| **Google Gemini** | Gemini 2.5 Flash for voice transcription, translation, English/Luganda agreements, old-document understanding, structured extraction and grounded rights assistance |
| **Google Maps Platform** | Satellite/street maps, location capture and boundary visualization |
| **Node.js compatibility API** | Existing REST contract retained during migration for behavioral parity and integration with the original PostgreSQL data layer |

---

## Modules

| Module | What it does |
|---|---|
| **Landing page** | Public marketing page with live impact figures, a feature tour, the SDG grid and a quick verify box |
| **Sign-in** | Split-screen phone and PIN login, plus one-click demo accounts for each role |
| **Dashboard** | KPI cards, records and seals over time, records by type, ledger integrity, audit activity, a mediation calendar, upcoming sessions, alerts, district chart and quick actions. Citizens get their own version. |
| **Land Map** | Every plot on satellite or street maps, coloured by status. Shows boundary-conflict pairs, a district filter and fly-to. |
| **Land Records** | Searchable, filterable and paginated table with tabs (all, sealed, drafts, consent flags, in dispute), a district breakdown and recent updates |
| **New Record wizard** | Six steps: land → people → terms (voice) → boundary (GPS walk, with **live overlap detection** against neighbouring plots) → witnesses and photos → review and seal. Includes protection checks and a spousal-consent block. |
| **Record detail** | Tabs for overview (map, people, witnesses), agreement (English/Luganda), evidence, disputes and activity. Also shows integrity status, QR code, seal hash and verification count, with a printable agreement and evidence pack. |
| **Old Papers** | Gemini reads a photo of an old agreement and pre-fills a new record |
| **Disputes & Mediation** | Kanban pipeline (reported → LC review → mediation → resolved / escalated) with drag-and-drop, mediator assignment, session scheduling and outcomes. Also shows upcoming sessions and categories. |
| **Verification** | Public verification page that asks who is checking (buyer, lender, mediator, court). Officials also see a full log, daily checks, verifier mix and forged-code attempts. |
| **Know My Rights** | Chat assistant grounded in a 14-entry Ugandan legal library, with citations and an English/Luganda toggle |
| **Ledger Explorer** | Block-by-block view of the hash chain. **Verify entire ledger** recomputes every entry. Drill down to the sealed payload. |
| **Reports & Impact** | SDG indicator scorecard (1.4.2, 5.a.1, 16.3, 16.6, 2.3, 8.10), district performance, gender, tenure, dispute categories, CSV exports and print to PDF |
| **Audit Trail** | Every significant action, filterable and paginated |
| **Settings** | Policy controls, organisation profile, notifications, users and roles, permission matrix, integrations, security, system health and a demo reset |
| **Notifications** | A bell that alerts owners when their record is verified, officials about overlaps and new disputes, and parties about mediation updates |

---

## 3D and photos

**3D views (three.js):**
- **3D plot model.** Available on every record, on the public verification page, and as a preview while drawing a boundary.
  - Shows the terrain, the plot itself, numbered boundary posts, the measured length of each edge, area, and a north arrow.
  - Neighbouring plots appear in grey and overlapping plots in red.
  - You can orbit, zoom, see a top view and switch auto-rotation on or off.
- **3D landing scene.** A floating island of mapped plots with the Ettaka seal hovering above it, which tilts as you move the pointer. The same scene appears on the sign-in page.
- **3D ledger chain.** Blocks linked in a chain in the Ledger Explorer. They turn green or red after **Verify entire ledger**, and clicking a block opens its sealed payload.
- **Accessibility and performance.** The views respect the "reduce motion" setting, fall back gracefully without WebGL, and load lazily so the main bundle stays small.

**Photos:**
- **Profile photos.** Users upload their own photo in **Settings → My profile**. It appears in the top bar, the audit trail and user lists.
- **Identity photos.** In the record wizard, tap the camera beside any party or witness to take their photo at the moment of the transaction.
  - Each photo is stored as evidence and SHA-256 fingerprinted.
  - Each photo's hash is bound to that person inside the seal, so swapping a photo is detected.
  - Identity photos are shown to signed-in users. They are not shown on the public portal, for privacy.
- **Illustrated portraits.** People without a photo get a portrait that is the same every time for the same name. The demo characters use these portraits rather than photos of real people, because some of them are written as land-grabbers or fraudsters.

## Quick start

**Requirements for the Flutter Web client:** Flutter SDK, Dart SDK, and a Firebase project configured for Authentication, Firestore and Storage. The compatibility API additionally requires Node.js 20 or later and PostgreSQL 14 or later; you can use a local install or run `docker compose up -d`.

On Vercel, the Vite client is public at `/`, the Express API is public at `/api/*`, and uploaded evidence files are intentionally not exposed through a public rewrite. Upload access must be provided through an authenticated API or signed storage URL.

The Vite client accepts `VITE_API_URL` at build time. Firebase Hosting currently serves the public client at [ettaka-devfest-2026.web.app](https://ettaka-devfest-2026.web.app). Set `VITE_API_URL` to the separately deployed Express API base URL before rebuilding and redeploying so login, records, disputes and other API-backed flows connect to production.

```bash
npm install && npm run install:all            # dependencies
# create the database (skip if using docker compose)
psql -U postgres -c "CREATE USER ettaka WITH PASSWORD 'ettaka' CREATEDB;"
psql -U postgres -c "CREATE DATABASE ettaka OWNER ettaka;"
cp server/.env.example server/.env            # add GEMINI_API_KEY (optional)
cp client/.env.example client/.env            # add VITE_GOOGLE_MAPS_API_KEY (optional)
npm run db:seed                               # schema + realistic demo data
npm run dev                                   # API :4000 and web :5173
```

Open **http://localhost:5173**.

To serve everything from one port, as you would in production, run `npm run build` and then `npm start`. The app is then at http://localhost:4000.

`npm run db:seed` resets everything. An administrator can also reset the data from **Settings → System health → Danger zone**.

### Demo accounts (PIN `1234`)

| Phone | Person | Role |
|---|---|---|
| 0700000001 | Nakato Sarah | Citizen: widow protecting her family kibanja |
| 0700000003 | Okello James | Citizen: buyer |
| 0700000002 | Namusoke Grace | LC1 Chairperson, Kigombya (Mukono) |
| 0700000006 | Ssekandi Musa | LC1 Chairperson, Kiteezi (Wakiso) |
| 0700000005 | Akello Harriet | Court-annexed mediator |
| 0700000004 | Ochieno David | System administrator |

The demo data covers:
- 51 plots across 12 districts, recorded over 12 months, 44 of them sealed
- 12 disputes at different stages of the mediation pipeline
- About 200 verifications, including forged-code attempts

Story records:

| Code | What it shows |
|---|---|
| `ETK-NKT4-2009` | The widow's sealed kibanja |
| `ETK-DBL9-KGB1` | A relative's attempted sale that **overlaps** her land and is flagged automatically |
| `ETK-OKL7-KTZ1` | A sealed purchase |
| `ETK-DRF3-KTZ2` | A draft blocked for missing spousal consent |

### Gemini and Google Maps

- Configure the Flutter Web build with `--dart-define=ETTAKA_API_URL=https://your-api.example.com/api`.
- Configure Firebase Authentication, Cloud Firestore and Cloud Storage for the Flutter Web project in `flutter_app`.
- Keep `GEMINI_API_KEY` server-side or in a Firebase callable function; never expose it in the browser bundle.
- Set `VITE_GOOGLE_MAPS_API_KEY` in the compatibility client environment, or use the equivalent Google Maps Web configuration for the Flutter Web map implementation.

For the hackathon judging demo, configure both keys before starting the application so the Google-powered flows are visible:

```bash
cd flutter_app
flutter pub get
flutter build web --dart-define=ETTAKA_API_URL=http://localhost:4000/api
```

Use the **Voice Terms**, **Old Papers**, **Know My Rights**, and **Land Map** screens to demonstrate the integrations. The Settings → Integrations panel shows whether Gemini and Google Maps are connected. If credentials are unavailable, the documented fallbacks keep the product demo runnable but should not be presented as the live Google integration.

Without keys, every feature still works using built-in fallbacks:
- Agreements are drafted from a template, in English only.
- The rights assistant returns matching legal provisions directly.
- Voice capture uses browser dictation.
- The document reader returns clearly labelled sample data.
- Maps use OpenStreetMap and Esri imagery.

**Phones at the demo:** browsers only allow GPS and the microphone over `https://` or `localhost`. Use a tunnel (for example `cloudflared tunnel --url http://localhost:5173`) or deploy to Cloud Run. Set `PUBLIC_APP_URL` so QR codes point to the right address.

---

## Three-minute demo script

1. **Story (0:00).** Open the landing page and tell Nakato's story.
2. **Catch the double sale (0:25).** Sign in as **LC1 Official**. On the dashboard, the *Needs your attention* panel flags that `ETK-DBL9-KGB1` overlaps Nakato's sealed kibanja by 100%. Open the **Land Map** to show the conflict.
3. **Record (0:50).** Choose **New Record → Land sale**.
   - Tick family land, add the people and speak the terms.
   - Draw the boundary. If it touches a recorded plot, the overlap warning appears **live**.
   - Add the witnesses and a photo of a boundary mark.
4. **Protect (1:30).** On the review step, sealing is **blocked** because spousal consent is missing. Record the consent, draft the agreement and **seal it**.
5. **Verify (1:55).** Open the QR link in a signed-out window as a *lender*. It shows **Authentic and unaltered**.
6. **Fraud (2:10).** Press **Change price**. Reload the verification page: it shows **Altered**, with the old and new values. Press **Restore**. Then open the **Ledger Explorer** and run **Verify entire ledger**.
7. **Justice and impact (2:35).** Show the **Disputes** kanban (drag a card into *Mediation*) and the **SDG scorecard** in Reports.

---

## How the seal works

1. **Canonical payload.** Sealing builds a canonical JSON payload: every field, party and witness, every boundary point, and the SHA-256 hash of every evidence file.
2. **Seal hash.** `seal = SHA-256(payload + previous seal + timestamp)`. It is stored in `seals`, which a PostgreSQL trigger makes **append-only**.
3. **Hash chain.** Each entry includes the previous entry's hash, so changing one entry breaks every later link.
4. **Verification.** Ettaka recomputes the hash and runs four checks:
   - the contents match the seal;
   - the ledger entry is intact;
   - the chain link to the previous entry is correct;
   - each evidence file on disk still matches its fingerprint.

   Any mismatch is reported field by field.

**Production hardening:**
- Anchor the ledger head outside the database, for example as a signed daily digest.
- Store evidence in Cloud Storage with retention locks.
- Serve uploaded files only to authorised users.

## Overlap detection

Every boundary is compared with every other recorded plot. The overlap area is estimated by grid sampling, which works for non-convex plots. Overlaps under 2% of the smaller plot are treated as GPS noise.

Overlaps appear in several places:
- live while drawing;
- as flags on the record;
- on the public verification page ("do not pay until resolved");
- as notifications to officials.

---

## Project structure

```
server/src
  index.js            Express app (also serves client/dist)
  schema.sql          Schema v2 incl. append-only ledger trigger
  seed.js             Deterministic demo dataset
  routes/             auth, records, disputes, public (verify, AI, demo), admin (analytics, ledger, logs, users, settings, exports, search)
  lib/                seal (hash chain), geo (area, overlap), ai (Gemini + fallbacks), legalCorpus, access, audit, records
client/src
  components/         Layout (sidebar, topbar, notifications), CommandPalette, ui kit, charts, BoundaryMap, VoiceInput, DisputeForm
  pages/              Landing, Login, Dashboard, LandMap, Records, RecordEditor, RecordView, Digitise, Disputes, Verify, Verification, Rights, Ledger, Reports, Activity, Settings
```

## Notes

- **Legal status.** Ettaka records are evidence of land rights, not land titles or Certificates of Customary Ownership.
- **Legal library.** `server/src/lib/legalCorpus.js` contains plain-language prototype summaries. A qualified advocate must check every entry against the current Revised Laws of Uganda before real use.
- **Data protection.** Personal data must be handled in line with the Data Protection and Privacy Act, 2019. Before deployment:
  - Set a strong `JWT_SECRET`.
  - Set `DEMO_MODE=false`.
