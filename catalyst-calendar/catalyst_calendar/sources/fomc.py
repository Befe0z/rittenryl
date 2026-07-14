"""FOMC meetings + minutes.

Meeting dates are a small curated table sourced from the Fed's official calendar
(``federalreserve.gov/monetarypolicy/fomccalendars.htm``) and verified Jul 2026.
The rate decision prints on the second day; minutes are released three weeks
(21 days) after the meeting at 14:00 ET.

Known meeting-day-two dates are ``CONFIRMED``. Years beyond the curated table
fall back to nothing (rather than guessing) — extend ``MEETINGS`` as the Fed
publishes each year. Minutes derived from a confirmed meeting are ``CONFIRMED``
(the Fed pre-announces the minutes date alongside the calendar).
"""

from __future__ import annotations

import datetime as _dt

from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

_SRC = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"

# (year, month, day-two-of-meeting). Verified against the Fed's 2026 calendar.
MEETINGS: list[tuple[int, int, int]] = [
    (2026, 1, 28),
    (2026, 3, 18),
    (2026, 4, 29),
    (2026, 6, 17),
    (2026, 7, 29),
    (2026, 9, 16),
    (2026, 10, 28),
    (2026, 12, 9),
]


class FomcSource(Source):
    name = "fomc"
    cadence = Cadence.WEEKLY
    requires_network = False  # curated + verified table

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        now = utcnow_iso()
        events = []
        for y, m, day in MEETINGS:
            decision = _dt.date(y, m, day)
            if window_start <= decision <= window_end:
                events.append(
                    CatalystEvent(
                        date=decision, type=CatalystType.MACRO_RELEASE, asset_or_universe="FOMC",
                        description="FOMC rate decision (meeting day 2)",
                        confidence=Confidence.CONFIRMED, source_url=_SRC,
                        first_seen=now, last_verified=now,
                        extra={"event": "decision", "period": decision.isoformat(),
                               "_key_extra": ["event", "period"]},
                    )
                )
            minutes = decision + _dt.timedelta(days=21)
            if window_start <= minutes <= window_end:
                events.append(
                    CatalystEvent(
                        date=minutes, type=CatalystType.MACRO_RELEASE, asset_or_universe="FOMC",
                        description="FOMC minutes release",
                        confidence=Confidence.CONFIRMED, source_url=_SRC,
                        first_seen=now, last_verified=now,
                        extra={"event": "minutes", "period": decision.isoformat(),
                               "_key_extra": ["event", "period"]},
                    )
                )
        return events
