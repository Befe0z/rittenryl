"""ETF launches / conversions / crypto-ETF catalysts from SEC EDGAR.

Two filing streams (endpoints verified Jul 2026, same EFTS full-text search host
as lockups):

* **485BPOS** post-effective amendments — a new/registered fund's effectiveness.
* **19b-4** rule-change dockets — the exchange rule filings that gate crypto
  *spot* ETFs specifically (the mechanism behind spot-BTC/ETH approvals). These
  carry SEC decision deadlines rather than a fixed effective date, so they are
  tagged ``ANNOUNCED_PENDING``.

Configurable watch terms drive the search (default includes the HYPE / BHYP
crypto watch). The response parser is fixture-tested; live search needs egress.
"""

from __future__ import annotations

import datetime as _dt
from typing import Iterable, Optional

from ..http_client import HttpClient
from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source
from .edgar_lockups import EFTS_SEARCH

DEFAULT_WATCH_TERMS = ["HYPE", "BHYP", "Hyperliquid", "spot bitcoin", "spot ether"]
# 485BPOS post-effective amendments are commonly designated effective ~60 days
# out; we estimate that and tag ESTIMATED unless a designated date is present.
_485_EFFECTIVE_DELAY_DAYS = 60


class EdgarEtfSource(Source):
    name = "edgar_etf"
    cadence = Cadence.ON_FILING_SWEEP
    requires_network = True

    def __init__(
        self,
        watch_terms: Optional[Iterable[str]] = None,
        client: Optional[HttpClient] = None,
    ):
        self.watch_terms = list(watch_terms or DEFAULT_WATCH_TERMS)
        self._client = client

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        client = self._client or HttpClient()
        events: list[CatalystEvent] = []
        for term in self.watch_terms:
            for forms in ("485BPOS", "19b-4"):
                try:
                    payload = client.get_json(
                        EFTS_SEARCH,
                        params={
                            "q": f'"{term}"',
                            "forms": forms,
                            "startdt": (window_start - _dt.timedelta(days=120)).isoformat(),
                            "enddt": window_end.isoformat(),
                        },
                    )
                except Exception:
                    continue
                events.extend(self.parse(payload, term, forms, window_start, window_end))
        # De-dupe within a fetch by canonical key (same accession seen twice).
        seen, deduped = set(), []
        for e in events:
            k = e.canonical_key()
            if k not in seen:
                seen.add(k)
                deduped.append(e)
        return deduped

    def parse(
        self, payload: dict, term: str, forms: str,
        window_start: _dt.date, window_end: _dt.date,
    ) -> list[CatalystEvent]:
        now = utcnow_iso()
        out = []
        hits = payload.get("hits", {}).get("hits", [])
        for hit in hits:
            src = hit.get("_source", {})
            filed = src.get("file_date") or src.get("filed")
            adsh = hit.get("_id", "").split(":")[0]
            display = (src.get("display_names") or ["unknown"])[0]
            try:
                filed_date = _dt.date.fromisoformat(filed[:10]) if filed else None
            except ValueError:
                filed_date = None
            if forms == "485BPOS":
                est = (filed_date or window_start) + _dt.timedelta(days=_485_EFFECTIVE_DELAY_DAYS)
                confidence = Confidence.ESTIMATED
                desc = f"ETF effectiveness (485BPOS, est.) — {display} [watch: {term}]"
                etype_event = "485BPOS_effective"
            else:  # 19b-4
                est = filed_date or window_start
                confidence = Confidence.ANNOUNCED_PENDING
                desc = f"Crypto ETF rule-change docket (19b-4) — {display} [watch: {term}]"
                etype_event = "19b4_docket"
            if not (window_start <= est <= window_end):
                continue
            out.append(
                CatalystEvent(
                    date=est, type=CatalystType.ETF_EVENT, asset_or_universe=term.upper(),
                    description=desc, confidence=confidence,
                    source_url=f"https://www.sec.gov/Archives/edgar/data/{src.get('cik','')}/{adsh}",
                    first_seen=now, last_verified=now,
                    extra={
                        "form": forms, "event": etype_event, "accession": adsh,
                        "filed": filed, "display_name": display,
                        "_key_extra": ["accession", "event"],
                    },
                )
            )
        return out
