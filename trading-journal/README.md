# rittenryl // decision journal

A local, single-user **decision journal** for discretionary traders — Soros /
Druckenmiller style. This is deliberately **not** a P&L log. It exists to force
and then aggregate good *decision process*: pre-registered invalidations,
pre-mortems, confluence checks, and honest post-trade grading — so you can see,
in aggregate, whether your process (not your luck) is improving.

Dark terminal aesthetic, IBM Plex Mono, teal-on-near-black. Keyboard-friendly,
dense monospace tables. No backend — everything persists to `localStorage`.

---

## Run

```bash
cd trading-journal
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run test     # vitest (run once)
npm run lint     # eslint (flat config, clean)
```

On first load the app **seeds sample data** (3 closed trade tickets + 2 daily
pages + 3 principles) so every chart renders immediately. Use
**Export / Import → Danger Zone → Clear everything** to start blank, or
**Reset to sample data** to restore the seed.

---

## The two enforced disciplines (the point of the app)

These are built into the UX, not just documented.

### 1. Required-before-open gate
A trade ticket **cannot** be saved in `OPEN` state unless **both**:
- **Pre-registered invalidation** is non-empty, and
- **Pre-mortem** is non-empty.

Clicking **Save as OPEN** with either missing shows an inline error summary and
blocks the save. Logic lives in `validateOpenGate()` in `src/lib/schema.js`.

### 2. Grade-before-P&L gate
On the exit/audit section, the **Realized P&L** input is **blurred, disabled and
read-only** until you pick a process grade (A–F) and press **Commit Grade**.
You grade the *decision quality* before the *result* is ever visible, so the
outcome can't bias the grade. Pressing **Revise Grade** re-locks P&L. Logic lives
in `isPnlUnlocked()` in `src/lib/schema.js`.

---

## Entry types

**Daily Page** — liquidity/macro read, one-line forward picture (18–24mo), state
check (physical / emotional / "am I trading my edge or my P&L?"), watchlist
(symbol + per-item trigger), risk map (net exposure + correlation clusters),
one-way-bet radar, end-of-day reflection.

**Trade Ticket** (`OPEN → CLOSED`) — instrument & structure, thesis, forward
picture, regime tag, confluence checklist (fundamental / tape / structure-vol +
divergence note), pre-registered invalidation, reversal condition, pre-mortem,
sizing (conviction, Kelly fraction, max-loss-vs-target, planned target R),
pilot/scaled + scale trigger, state at entry, plus two analytics tags on every
ticket: **idea source** and **hypothesis engine**. Exit/audit adds exit reason,
realized R, process grade, mistake tag, right/wrong-for-right-reasons, one
lesson, and P&L.

---

## Aggregation deck (why this beats a markdown folder)

Recharts views over all closed & graded tickets (`src/lib/aggregations.js`):

- **Process-grade distribution** (A–F bar)
- **Grade × outcome** cross-tab — visually flags the **dangerous quadrant**: a
  *win* produced by a *low-grade (D/E/F)* process (you got paid for a bad
  decision). A red banner + red-outlined bars call it out.
- **Idea-source × grade/R** and **hypothesis-engine × grade/R**
- **Planned-vs-realized R** scatter — is your asymmetry estimate honest?
- **Entry-state × outcome**
- **Mistake-tag frequency over time**

**Weekly Review** scopes all of the above to a chosen ISO week (Mon–Sun).

**Standing Principles Ledger** — an editable table of principle / trade that
taught it / date.

---

## Persistence & the storage seam

All persistence goes through a single module, `src/lib/storage.js`, which
exposes `storage.load() / save() / replace() / reset()`. The rest of the app
never touches `localStorage` directly. To swap in a local SQLite service later,
implement the same interface in a new adapter and export it from that module —
no other code needs to change. The persisted document is a single JSON object:

```jsonc
{ "version": 1, "tickets": [...], "dailies": [...], "principles": [...] }
```

---

## Export / import format

Both formats **round-trip**: export → re-import → identical data.

- **JSON** (`journal-YYYY-MM-DD.json`) — the byte-exact backup path.
- **Markdown** (`journal-YYYY-MM-DD.md`) — a clean, heading-per-field
  representation intended to be human-readable *and* machine-parseable. It is
  organized as `## Daily Pages`, `## Trade Tickets`, `## Standing Principles
  Ledger`; each record is a `###` block; single-line fields are `- **Label:**
  value` and multi-line fields are `#### Label` heading blocks. Confluence
  checkboxes serialize as `[x]`/`[ ]`; watchlist items carry a `[id]` token so
  the list round-trips exactly. Serializer and parser are driven by shared
  field-spec tables in `src/lib/serialize.js` so they can't drift.

---

## Tests

`npm run test` — 18 tests, all passing:

- **Required-before-open gate** blocks a save with empty invalidation or empty
  pre-mortem, and allows it when both are present (`gates.test.js`).
- **Grade-before-P&L gate** — pure logic plus a rendered-UI test asserting the
  P&L input is disabled/blurred until grade is committed, then enabled
  (`gates.test.js`, `gate-ui.test.jsx`).
- **Markdown round-trip** and **JSON round-trip** to identical data, including
  multi-line fields and confluence booleans (`roundtrip.test.js`).
- **Dangerous-quadrant** aggregation correctly identifies a win on a low-grade
  process (`aggregations.test.js`).

---

## Project layout

```
trading-journal/
├── index.html                 # IBM Plex Mono via Google Fonts (presentation only)
├── package.json
├── vite.config.js             # Vite + Vitest (jsdom)
├── eslint.config.js           # flat config, clean
├── README.md
└── src/
    ├── main.jsx
    ├── App.jsx                # sidebar shell + view routing
    ├── index.css              # dark-terminal design system
    ├── store.js               # React binding over the storage seam
    ├── lib/
    │   ├── schema.js          # factories, enums, gate logic
    │   ├── storage.js         # persistence seam (localStorage adapter)
    │   ├── seed.js            # sample data
    │   ├── serialize.js       # JSON + Markdown export/import (round-trip)
    │   └── aggregations.js    # chart data + dangerous-quadrant detection
    ├── components/
    │   ├── Fields.jsx         # reusable form primitives
    │   ├── Charts.jsx         # Recharts, themed
    │   ├── Dashboard.jsx
    │   ├── TradeTickets.jsx   # ticket list + form with BOTH gates
    │   ├── DailyPages.jsx
    │   ├── WeeklyReview.jsx
    │   ├── Principles.jsx
    │   └── DataMenu.jsx       # export / import / reset
    └── tests/
        ├── gates.test.js
        ├── gate-ui.test.jsx
        ├── roundtrip.test.js
        └── aggregations.test.js
```
