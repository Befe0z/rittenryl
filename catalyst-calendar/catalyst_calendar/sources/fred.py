"""FRED release calendar — scheduled macro data releases.

Endpoint verified (Jul 2026):
``https://api.stlouisfed.org/fred/release/dates`` with params
``release_id``, ``api_key``, ``file_type=json``,
``include_release_dates_with_no_data=true`` (needed so *future* release dates
are returned), plus ``realtime_start``/``realtime_end`` to bound the window.

Release IDs used (stable):

* **10** — Consumer Price Index (BLS CPI)
* **50** — Employment Situation (BLS NFP / jobs report)

FRED publishes the source-declared release dates, so these are ``CONFIRMED``.
The parser (:meth:`parse`) is unit-tested against a recorded fixture; the live
call needs an API key + egress.
"""

from __future__ import annotations

import datetime as _dt
from typing import Optional

from ..http_client import HttpClient
from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

FRED_BASE = "https://api.stlouisfed.org/fred"

# release_id -> (asset_or_universe, human description)
DEFAULT_RELEASES = {
    10: ("CPI", "US CPI release (BLS Consumer Price Index)"),
    50: ("NFP", "US Employment Situation / Nonfarm Payrolls (BLS)"),
}


class FredReleaseSource(Source):
    name = "fred"
    cadence = Cadence.WEEKLY
    requires_network = True

    def __init__(
        self,
        api_key: Optional[str] = None,
        releases: Optional[dict[int, tuple[str, str]]] = None,
        client: Optional[HttpClient] = None,
    ):
        self.api_key = api_key
        self.releases = releases or DEFAULT_RELEASES
        self._client = client

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        if not self.api_key:
            raise RuntimeError(
                "FRED source requires an API key. Pass api_keys={'fred': '...'} "
                "to Calendar.register_network_sources, or set it on the source."
            )
        client = self._client or HttpClient()
        events: list[CatalystEvent] = []
        for release_id, (asset, desc) in self.releases.items():
            payload = client.get_json(
                f"{FRED_BASE}/release/dates",
                params={
                    "release_id": release_id,
                    "api_key": self.api_key,
                    "file_type": "json",
                    "include_release_dates_with_no_data": "true",
                    "realtime_start": window_start.isoformat(),
                    "realtime_end": window_end.isoformat(),
                },
            )
            events.extend(self.parse(payload, release_id, asset, desc, window_start, window_end))
        return events

    def parse(
        self,
        payload: dict,
        release_id: int,
        asset: str,
        desc: str,
        window_start: _dt.date,
        window_end: _dt.date,
    ) -> list[CatalystEvent]:
        now = utcnow_iso()
        out = []
        source_url = f"https://fred.stlouisfed.org/release?rid={release_id}"
        for rd in payload.get("release_dates", []):
            try:
                d = _dt.date.fromisoformat(rd["date"])
            except (KeyError, ValueError):
                continue
            if not (window_start <= d <= window_end):
                continue
            out.append(
                CatalystEvent(
                    date=d, type=CatalystType.MACRO_RELEASE, asset_or_universe=asset,
                    description=desc, confidence=Confidence.CONFIRMED, source_url=source_url,
                    first_seen=now, last_verified=now,
                    extra={
                        "release_id": release_id,
                        "period": d.isoformat(),
                        "_key_extra": ["release_id", "period"],
                    },
                )
            )
        return out
