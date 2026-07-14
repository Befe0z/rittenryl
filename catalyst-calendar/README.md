# Structural-Catalyst Calendar

A refreshable **forward calendar of structural / non-economic catalysts** — dates
where a *forced or mechanical actor* trades regardless of price (options
expirations, scheduled data releases, IPO lockups, ETF effectiveness, index
rebalances, token unlocks).

This is **not a signal generator and not a directional-bet tool**. It is a
lookahead of known dates you filter discretionarily.

```python
from catalyst_calendar import Calendar

cal = Calendar("catalysts.db")
cal.refresh("opex")                          # pure computation, no network
cal.register_network_sources({"eia": EIA_KEY, "fred": FRED_KEY})
cal.refresh("fomc"); cal.refresh("index_rebalance")

for e in cal.upcoming(days=30, types=["OPEX_QUARTERLY"]):
    print(e.date, e.confidence, e.description)
```

CLI demo (mechanical, no keys required):

```
python -m catalyst_calendar.cli --days 60 --no-network
```

## Design invariants (from the build spec)

- **Confidence on every event**, never silently promoted:
  `CONFIRMED` (published/mechanical) · `ESTIMATED` (computed, e.g. lockup =
  IPO+180d) · `ANNOUNCED_PENDING` (change announced, effective date not final).
- **Audit trail, never destructive overwrite.** A moved date or a confirmed
  estimate *supersedes* the old row (`active=0`, `supersede_reason`,
  `superseded_by`) and writes a new active row — the same `SUPERSEDED_BAD_DATA`
  discipline. `store.history(key)` returns the full trail.
- **Idempotent refresh.** Identity is `CatalystEvent.canonical_key()` (derived
  from type/asset/description + declared `_key_extra`, **not** the date), so a
  clean re-run only bumps `last_verified`; the active event count is stable.
- **EDGAR politeness**: declared `User-Agent` (`CATALYST_USER_AGENT` env) and a
  rate limiter (<5 req/s, under SEC's 10 req/s ceiling).

Normalized schema:
`{date, type, asset_or_universe, description, confidence, source_url,
first_seen, last_verified, superseded_by}` (+ `supersede_reason`, `extra`).

## Sources & verified endpoints (Jul 2026)

Built highest-confidence / lowest-effort first:

| # | Source (module) | Endpoint verified Jul 2026 | Confidence | Notes |
|---|---|---|---|---|
| 1 | `opex` | none — pure computation | CONFIRMED | 3rd-Friday monthly + Mar/Jun/Sep/Dec triple-witching (flagged separately); Good-Friday roll to Thu |
| 2 | `eia` | `api.eia.gov/v2/` | CONFIRMED | WPSR Wed / NatGas storage Thu, holiday-shifted; API key anchors liveness |
| 2 | `fred` | `api.stlouisfed.org/fred/release/dates` | CONFIRMED | CPI (rid 10) + NFP/Employment Situation (rid 50); needs key |
| 2 | `cftc` | `publicreporting.cftc.gov/resource/6dca-aqww.json` | CONFIRMED | COT Fri release, holiday-shifted; Socrata anchor |
| 2 | `fomc` | `federalreserve.gov/.../fomccalendars.htm` | CONFIRMED | curated + verified 2026 meetings; minutes = +21d |
| 3 | `edgar_lockups` | `efts.sec.gov/LATEST/search-index`, `data.sec.gov/submissions` | ESTIMATED | IPO+180d default; flags staggered / early-release; easy single-name `estimate()` (SPCX use case) |
| 4 | `edgar_etf` | `efts.sec.gov/LATEST/search-index` | ESTIMATED / ANNOUNCED_PENDING | 485BPOS effectiveness + 19b-4 crypto dockets; HYPE/BHYP watch |
| 5 | `index_rebalance` | provider pages | CONFIRMED (schedule) | S&P quarterly / Russell June recon / Nasdaq-100 Dec; add/delete announcement scrape is **stubbed** (not faked) |
| 6 | `token_unlocks` | — (stub) | as supplied | interface wired; consumes an explicit vesting schedule only |

### Refresh cadence

`opex`: compute once (extend window). `eia`/`cftc`/`fred`: weekly.
`index_rebalance`: weekly during announcement windows. `edgar_lockups`/`edgar_etf`:
on new-filing sweep (`Cadence.ON_FILING_SWEEP`).

## ⚠️ Sandbox networking caveat

The environment this was built in blocks egress to `data.sec.gov`, `efts.sec.gov`,
`api.eia.gov`, `api.bls.gov`, `api.stlouisfed.org`, and `publicreporting.cftc.gov`
at the proxy, so **network calls could not be live-tested here**. Endpoints were
verified against current documentation, and each source is structured so its
parser is unit-tested against recorded fixtures and its live call self-verifies
on first real run (EIA/CFTC expose `latest_period` / `latest_report_date`
liveness anchors). Run the network sources from an environment with egress and a
declared `CATALYST_USER_AGENT`.

## Tests

```
pip install -r requirements.txt pytest
pytest -q          # 30 tests
```

Covered: 2026 triple-witching matches known dates; lockup computes to IPO+180d
and is never CONFIRMED; EIA/CFTC/FOMC/index computed dates; FRED/EDGAR parsers on
fixtures; idempotency (refresh twice → count stable); supersede/audit trail.

## Layout

```
catalyst_calendar/
  schema.py          # CatalystEvent, Confidence, canonical_key (identity)
  store.py           # SQLite store: idempotent upsert + supersede/audit trail
  calendar.py        # Calendar facade: upcoming(), refresh registry
  holidays.py        # US federal holidays (release-date shifting)
  http_client.py     # UA + rate limit + CA-bundle-aware requests wrapper
  cli.py             # python -m catalyst_calendar.cli
  sources/
    base.py opex.py eia.py fred.py cftc.py fomc.py
    edgar_lockups.py edgar_etf.py index_rebalance.py token_unlocks.py
tests/               # 30 offline tests
```
