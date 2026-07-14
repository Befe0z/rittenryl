"""Index rebalance / reconstitution catalysts.

Two layers:

* **Scheduled effective dates** (computable, ``CONFIRMED``):
    - S&P quarterly rebalance — effective after the 3rd Friday of Mar/Jun/Sep/Dec.
    - Russell annual reconstitution — effective after the last Friday of June.
    - Nasdaq-100 annual reconstitution — effective before the 3rd Friday of Dec.
* **Add/delete announcements** (``ANNOUNCED_PENDING``, scrape-dependent): the
  specific names land days before the effective date on the provider's
  announcement page. Those pages have no stable API, so the scrape is stubbed
  behind :meth:`fetch_announcements` — it returns nothing and logs a note rather
  than inventing dates. Wire a provider parser in when you need names.

Build-last per the spec: the schedule is reliable; the announcements are the
fragile, scrape-only part and are intentionally not faked.
"""

from __future__ import annotations

import datetime as _dt

from ..holidays import _nth_weekday
from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

_SP_URL = "https://www.spglobal.com/spdji/en/governance/methodology-and-regulatory-status/"
_RUSSELL_URL = "https://www.lseg.com/en/ftse-russell/index-reconstitution"
_NDX_URL = "https://www.nasdaq.com/market-activity/quotes/nasdaq-ndx-index"

_QUARTERLY_MONTHS = (3, 6, 9, 12)


def _third_friday(year: int, month: int) -> _dt.date:
    return _nth_weekday(year, month, 4, 3)  # Fri=4, 3rd


def _last_friday(year: int, month: int) -> _dt.date:
    return _nth_weekday(year, month, 4, -1)


class IndexRebalanceSource(Source):
    name = "index_rebalance"
    cadence = Cadence.WEEKLY  # weekly during announcement windows
    requires_network = False  # scheduled dates computed; announcements are stubbed

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        now = utcnow_iso()
        events: list[CatalystEvent] = []
        for year in range(window_start.year, window_end.year + 1):
            # S&P quarterly — effective after 3rd Friday close of the quarter month.
            for m in _QUARTERLY_MONTHS:
                eff = _third_friday(year, m)
                events.append(self._sched(eff, "S&P 500", f"S&P quarterly rebalance effective ({eff:%b %Y})", _SP_URL, now, f"sp-{year}-{m}"))
            # Russell — effective after last Friday of June.
            r = _last_friday(year, 6)
            events.append(self._sched(r, "Russell 3000/2000", f"Russell annual reconstitution effective ({r:%b %Y})", _RUSSELL_URL, now, f"russell-{year}"))
            # Nasdaq-100 — annual reconstitution effective prior to 3rd Friday of Dec.
            n = _third_friday(year, 12)
            events.append(self._sched(n, "Nasdaq-100", f"Nasdaq-100 annual reconstitution effective ({n:%b %Y})", _NDX_URL, now, f"ndx-{year}"))
        events.extend(self.fetch_announcements(window_start, window_end))
        return [e for e in events if window_start <= e.date_obj <= window_end]

    def _sched(self, date, universe, desc, url, now, period) -> CatalystEvent:
        return CatalystEvent(
            date=date, type=CatalystType.INDEX_REBALANCE, asset_or_universe=universe,
            description=desc, confidence=Confidence.CONFIRMED, source_url=url,
            first_seen=now, last_verified=now,
            extra={"period": period, "kind": "scheduled_effective", "_key_extra": ["period"]},
        )

    def fetch_announcements(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        """Scrape provider announcement pages for add/delete names.

        STUB: provider pages have no stable API and change layout; rather than
        emit fabricated dates, this returns []. Implement a per-provider HTML
        parser here (S&P announcement PDF, FTSE Russell recon files, Nasdaq press
        releases) to produce ANNOUNCED_PENDING events during the ~1-week window
        before each effective date.
        """
        return []
