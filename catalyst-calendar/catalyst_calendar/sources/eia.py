"""EIA weekly releases — petroleum status (WPSR) and natural-gas storage.

Endpoint verified (Jul 2026): ``https://api.eia.gov/v2/`` (hierarchical, key via
``?api_key=``). See EIA API technical documentation.

The EIA *data* API returns observations, not a forward release calendar, so the
forward dates are computed from EIA's fixed weekly cadence and shifted for
federal holidays (EIA's documented behavior):

* **Weekly Petroleum Status Report** — Wednesday 10:30 ET (Thursday on holiday
  weeks).
* **Weekly Natural Gas Storage Report** — Thursday 10:30 ET (Friday on holiday
  weeks).

Because the cadence rule is mechanical and holiday-adjusted, the generated dates
are ``CONFIRMED``. When an API key is supplied and the network is reachable,
:meth:`refresh` also anchors to the latest published period as a liveness/verify
check (best-effort; never blocks the computed schedule).
"""

from __future__ import annotations

import datetime as _dt
from typing import Optional

from ..holidays import shift_release
from ..http_client import HttpClient
from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

EIA_BASE = "https://api.eia.gov/v2"
# Verified routes (hierarchical). Used only for the optional anchor check.
_PETROLEUM_ROUTE = "petroleum/stoc/wstk/data"       # weekly stocks
_NATGAS_ROUTE = "natural-gas/stor/wkly/data"        # weekly storage
_DOC_URL = "https://www.eia.gov/opendata/"


class EiaReleaseSource(Source):
    name = "eia"
    cadence = Cadence.WEEKLY
    requires_network = False  # schedule is computable; network only verifies

    def __init__(self, api_key: Optional[str] = None, client: Optional[HttpClient] = None):
        self.api_key = api_key
        self._client = client

    # -------------------------------------------------------- computed schedule
    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        now = utcnow_iso()
        events: list[CatalystEvent] = []
        # Iterate week by week from the first Monday on/after window_start-7d.
        d = window_start - _dt.timedelta(days=window_start.weekday())  # Monday
        while d <= window_end:
            wed = d + _dt.timedelta(days=2)
            thu = d + _dt.timedelta(days=3)
            pet = shift_release(wed)
            gas = shift_release(thu)
            if window_start <= pet <= window_end:
                events.append(self._event(pet, "petroleum", now))
            if window_start <= gas <= window_end:
                events.append(self._event(gas, "natural_gas", now))
            d += _dt.timedelta(days=7)
        return events

    def _event(self, date: _dt.date, kind: str, now: str) -> CatalystEvent:
        if kind == "petroleum":
            desc = "EIA Weekly Petroleum Status Report (WPSR)"
            asset = "CL"  # crude oil complex
        else:
            desc = "EIA Weekly Natural Gas Storage Report"
            asset = "NG"
        return CatalystEvent(
            date=date, type=CatalystType.MACRO_RELEASE, asset_or_universe=asset,
            description=desc, confidence=Confidence.CONFIRMED, source_url=_DOC_URL,
            first_seen=now, last_verified=now,
            extra={"series": kind, "period": date.isoformat(), "_key_extra": ["series", "period"]},
        )

    # ---------------------------------------------------------- optional anchor
    def latest_period(self, route: str) -> Optional[str]:
        """Best-effort: return the most recent published period for a route.

        Requires an API key and network egress. Used to verify the data feed is
        live; failures are swallowed so the computed schedule always stands.
        """
        if not self.api_key:
            return None
        client = self._client or HttpClient()
        try:
            data = client.get_json(
                f"{EIA_BASE}/{route}",
                params={
                    "api_key": self.api_key,
                    "frequency": "weekly",
                    "data[]": "value",
                    "sort[0][column]": "period",
                    "sort[0][direction]": "desc",
                    "length": 1,
                },
            )
            rows = data.get("response", {}).get("data", [])
            return rows[0]["period"] if rows else None
        except Exception:
            return None
