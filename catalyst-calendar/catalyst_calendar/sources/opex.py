"""Options-expiration catalysts — pure computation, no network.

Covers:

* **Monthly opex** — the 3rd Friday of every month (equity/ETF standard
  monthlies). Confidence ``CONFIRMED`` because the rule is mechanical.
* **Quarterly triple-witching** — the 3rd Friday of Mar/Jun/Sep/Dec, when stock
  index futures, index options and single-stock options all expire together.
  Flagged as its own type (``OPEX_QUARTERLY``) because dealer-gamma and
  positioning matter most there; the monthly of those months is *not* also
  emitted as a plain monthly.

Holiday note: US listed options settle to the 3rd Friday; on the rare occasion
that Friday is an exchange holiday, expiration moves to the preceding Thursday.
Good Friday is the practical case. We adjust for it here so the mechanical dates
stay CONFIRMED and correct.
"""

from __future__ import annotations

import datetime as _dt
from typing import Iterator

from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

_QUARTERLY_MONTHS = {3, 6, 9, 12}
_SOURCE_URL = "computed://opex/third-friday-rule"


def third_friday(year: int, month: int) -> _dt.date:
    """Third Friday of the given month."""
    d = _dt.date(year, month, 1)
    # weekday(): Mon=0 .. Fri=4. Days until the first Friday:
    offset = (4 - d.weekday()) % 7
    first_friday = d + _dt.timedelta(days=offset)
    return first_friday + _dt.timedelta(days=14)


def _good_friday(year: int) -> _dt.date:
    """Western Good Friday (Anonymous Gregorian / Meeus algorithm - 2 days)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    m = (32 + 2 * e + 2 * i - h - k) % 7
    n = (a + 11 * h + 22 * m) // 451
    month = (h + m - 7 * n + 114) // 31
    day = ((h + m - 7 * n + 114) % 31) + 1
    easter = _dt.date(year, month, day)
    return easter - _dt.timedelta(days=2)


def expiration_date(year: int, month: int) -> _dt.date:
    """Third Friday, rolled back to Thursday if it collides with Good Friday."""
    exp = third_friday(year, month)
    if exp == _good_friday(year):
        return exp - _dt.timedelta(days=1)
    return exp


def _months(start: _dt.date, end: _dt.date) -> Iterator[tuple[int, int]]:
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


class OpexSource(Source):
    name = "opex"
    cadence = Cadence.ONCE
    requires_network = False

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        now = utcnow_iso()
        events: list[CatalystEvent] = []
        for year, month in _months(window_start, window_end):
            exp = expiration_date(year, month)
            if not (window_start <= exp <= window_end):
                continue
            quarterly = month in _QUARTERLY_MONTHS
            if quarterly:
                etype = CatalystType.OPEX_QUARTERLY
                desc = f"Quarterly triple-witching expiration ({exp.strftime('%b %Y')})"
            else:
                etype = CatalystType.OPEX_MONTHLY
                desc = f"Monthly options expiration ({exp.strftime('%b %Y')})"
            rolled = exp != third_friday(year, month)
            events.append(
                CatalystEvent(
                    date=exp,
                    type=etype,
                    asset_or_universe="US_LISTED_OPTIONS",
                    description=desc,
                    confidence=Confidence.CONFIRMED,
                    source_url=_SOURCE_URL,
                    first_seen=now,
                    last_verified=now,
                    extra={
                        "quarterly": quarterly,
                        "rolled_for_holiday": rolled,
                        # period is part of identity so each month stays distinct
                        "period": f"{year}-{month:02d}",
                        "_key_extra": ["period"],
                    },
                )
            )
        return events
