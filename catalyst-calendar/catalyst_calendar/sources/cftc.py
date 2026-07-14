"""CFTC Commitments of Traders (COT) — weekly Friday release.

Endpoint verified (Jul 2026): Socrata public reporting API,
``https://publicreporting.cftc.gov/resource/6dca-aqww.json`` (Legacy
Futures-Only), supporting ``$select/$where/$order/$limit``.

The COT report publishes Fridays at 15:30 ET for positions as of the prior
Tuesday, slipping one business day on holiday weeks. Forward release dates are
therefore computed (``CONFIRMED``); the Socrata API is used only as an optional
liveness anchor (latest ``report_date_as_yyyy_mm_dd``).
"""

from __future__ import annotations

import datetime as _dt
from typing import Optional

from ..holidays import shift_release
from ..http_client import HttpClient
from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

CFTC_LEGACY_FUT = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"
_DOC_URL = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm"


class CftcCotSource(Source):
    name = "cftc"
    cadence = Cadence.WEEKLY
    requires_network = False  # schedule computable; network only verifies

    def __init__(self, client: Optional[HttpClient] = None):
        self._client = client

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        now = utcnow_iso()
        events = []
        d = window_start - _dt.timedelta(days=window_start.weekday())  # Monday
        while d <= window_end:
            fri = d + _dt.timedelta(days=4)
            rel = shift_release(fri)
            if window_start <= rel <= window_end:
                events.append(
                    CatalystEvent(
                        date=rel, type=CatalystType.MACRO_RELEASE, asset_or_universe="CFTC_COT",
                        description="CFTC Commitments of Traders (weekly positioning release)",
                        confidence=Confidence.CONFIRMED, source_url=_DOC_URL,
                        first_seen=now, last_verified=now,
                        extra={"period": rel.isoformat(), "_key_extra": ["period"]},
                    )
                )
            d += _dt.timedelta(days=7)
        return events

    def latest_report_date(self) -> Optional[str]:
        """Optional liveness anchor via Socrata (needs egress)."""
        client = self._client or HttpClient()
        try:
            rows = client.get_json(
                CFTC_LEGACY_FUT,
                params={
                    "$select": "report_date_as_yyyy_mm_dd",
                    "$order": "report_date_as_yyyy_mm_dd DESC",
                    "$limit": 1,
                },
            )
            return rows[0]["report_date_as_yyyy_mm_dd"][:10] if rows else None
        except Exception:
            return None
