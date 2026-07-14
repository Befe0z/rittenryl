"""Crypto token unlocks / vesting cliffs — the tokenomics analog of IPO lockups.

Per the spec: wire the interface, stub the source. A token unlock is structurally
identical to a lockup (a large, price-insensitive supply increase on a known
date), so it uses the same normalized event with ``TOKEN_UNLOCK`` type.

Feed a schedule explicitly (from a vesting doc or a provider you trust) via
``schedule`` entries::

    {"symbol": "TIA", "date": "2026-10-01", "pct_supply": 8.3,
     "note": "cliff unlock", "confidence": "CONFIRMED", "source_url": "..."}

No live provider is queried (no vetted, stable public API), so nothing is
fabricated; :meth:`fetch` only emits what you supply.
"""

from __future__ import annotations

import datetime as _dt
from typing import Iterable, Optional

from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source


class TokenUnlockSource(Source):
    name = "token_unlocks"
    cadence = Cadence.WEEKLY
    requires_network = False  # stub: consumes an explicit schedule only

    def __init__(self, schedule: Optional[Iterable[dict]] = None):
        self.schedule = list(schedule or [])

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        now = utcnow_iso()
        out = []
        for row in self.schedule:
            try:
                d = _dt.date.fromisoformat(str(row["date"])[:10])
            except (KeyError, ValueError):
                continue
            if not (window_start <= d <= window_end):
                continue
            conf = row.get("confidence", Confidence.ESTIMATED.value)
            out.append(
                CatalystEvent(
                    date=d, type=CatalystType.TOKEN_UNLOCK,
                    asset_or_universe=str(row["symbol"]).upper(),
                    description=row.get("note", f"{row['symbol']} token unlock / vesting cliff"),
                    confidence=conf,
                    source_url=row.get("source_url", "stub://token-unlocks/manual-schedule"),
                    first_seen=now, last_verified=now,
                    extra={"pct_supply": row.get("pct_supply"), "period": d.isoformat(),
                           "_key_extra": ["period"]},
                )
            )
        return out
