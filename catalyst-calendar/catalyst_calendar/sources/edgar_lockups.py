"""IPO lockup expirations from SEC EDGAR (S-1 / 424B filings).

Endpoints verified (Jul 2026):

* Full-text search: ``https://efts.sec.gov/LATEST/search-index`` (params
  ``q``, ``forms``, ``startdt``, ``enddt``, ``ciks``). UA required, < 10 req/s.
* Submissions:      ``https://data.sec.gov/submissions/CIK##########.json``.

Default estimate is **IPO date + 180 days**, tagged ``ESTIMATED`` — never
promoted to ``CONFIRMED`` by this module. When the prospectus text is available,
:meth:`parse_lockup_terms` flags staggered releases and early-release triggers
(price/volume conditions) and surfaces any explicit day-count so a human can
refine the estimate.

Single-name convenience (the SPCX ~Dec-2026 use case)::

    src = EdgarLockupSource()
    ev = src.estimate("SPCX", ipo_date=date(2026, 6, 10))   # -> IPO+180d, ESTIMATED
"""

from __future__ import annotations

import datetime as _dt
import re
from typing import Iterable, Optional

from ..http_client import HttpClient
from ..schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from .base import Cadence, Source

EFTS_SEARCH = "https://efts.sec.gov/LATEST/search-index"
SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"

DEFAULT_LOCKUP_DAYS = 180

# Regexes over prospectus lock-up language.
_DAYS_RE = re.compile(
    r"(?:lock-?up|not\s+to\s+(?:sell|dispose|offer)|period\s+of|restricted\s+period)"
    r"[^.]{0,160}?(\d{2,3})\s*[- ]?day",
    re.I | re.S,
)
_STAGGERED_RE = re.compile(
    r"(stagger|in\s+(?:two|three|multiple)\s+tranches|(\d{2,3})%\s+of\s+the\s+shares[^.]{0,80}?(\d{2,3})\s*days|"
    r"early\s+release|release[d]?\s+early|expire[s]?\s+in\s+part)",
    re.I | re.S,
)
_EARLY_TRIGGER_RE = re.compile(
    r"(if\s+the\s+(?:closing|last\s+reported)\s+price|price\s+condition|"
    r"trading\s+day[s]?\s+(?:during|within)|(\d{1,3})%\s+(?:above|greater))",
    re.I | re.S,
)


def parse_lockup_terms(text: str) -> dict:
    """Extract structured lock-up hints from prospectus text.

    Returns ``{days, staggered, early_release, notes}``. Purely heuristic — the
    output is advisory metadata attached to an ``ESTIMATED`` event, not a
    promotion to ``CONFIRMED``.
    """
    notes = []
    days_match = _DAYS_RE.search(text)
    days = int(days_match.group(1)) if days_match else None
    if days:
        notes.append(f"filing mentions a {days}-day lock-up")
    staggered = bool(_STAGGERED_RE.search(text))
    if staggered:
        notes.append("staggered / partial-release language detected")
    early = bool(_EARLY_TRIGGER_RE.search(text))
    if early:
        notes.append("price/volume early-release trigger detected")
    return {
        "days": days,
        "staggered": staggered,
        "early_release": early,
        "notes": "; ".join(notes) or "no explicit lock-up terms parsed",
    }


class EdgarLockupSource(Source):
    name = "edgar_lockups"
    cadence = Cadence.ON_FILING_SWEEP
    requires_network = True

    def __init__(
        self,
        watchlist: Optional[Iterable[dict]] = None,
        client: Optional[HttpClient] = None,
    ):
        # watchlist entries: {"ticker": str, "ipo_date": "YYYY-MM-DD",
        #                     "cik": Optional[int], "prospectus_text": Optional[str]}
        self.watchlist = list(watchlist or [])
        self._client = client

    # ---------------------------------------------------- single-name estimate
    def estimate(
        self,
        ticker: str,
        ipo_date: _dt.date | str,
        lockup_days: int = DEFAULT_LOCKUP_DAYS,
        prospectus_text: Optional[str] = None,
        cik: Optional[int] = None,
        source_url: Optional[str] = None,
    ) -> CatalystEvent:
        ipo = ipo_date if isinstance(ipo_date, _dt.date) else _dt.date.fromisoformat(str(ipo_date)[:10])
        terms = parse_lockup_terms(prospectus_text) if prospectus_text else {
            "days": None, "staggered": False, "early_release": False,
            "notes": "estimate only; prospectus not parsed",
        }
        days = terms.get("days") or lockup_days
        expiry = ipo + _dt.timedelta(days=days)
        now = utcnow_iso()
        src = source_url or (
            f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}" if cik
            else "https://efts.sec.gov/LATEST/search-index"
        )
        desc = f"{ticker.upper()} IPO lock-up expiration (IPO+{days}d, ESTIMATED)"
        return CatalystEvent(
            date=expiry, type=CatalystType.IPO_LOCKUP, asset_or_universe=ticker.upper(),
            description=desc, confidence=Confidence.ESTIMATED, source_url=src,
            first_seen=now, last_verified=now,
            extra={
                "ipo_date": ipo.isoformat(),
                "lockup_days": days,
                "staggered": terms["staggered"],
                "early_release": terms["early_release"],
                "notes": terms["notes"],
                "cik": cik,
            },
        )

    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        out = []
        for entry in self.watchlist:
            ev = self.estimate(
                ticker=entry["ticker"],
                ipo_date=entry["ipo_date"],
                lockup_days=entry.get("lockup_days", DEFAULT_LOCKUP_DAYS),
                prospectus_text=entry.get("prospectus_text"),
                cik=entry.get("cik"),
                source_url=entry.get("source_url"),
            )
            if window_start <= ev.date_obj <= window_end:
                out.append(ev)
        return out

    # ------------------------------------------------------- EDGAR helpers (net)
    def lookup_ipo_date(self, cik: int) -> Optional[_dt.date]:
        """Best-effort IPO date = earliest 424B/EFFECT filing date via submissions."""
        client = self._client or HttpClient()
        try:
            data = client.get_json(SUBMISSIONS.format(cik=cik))
            recent = data.get("filings", {}).get("recent", {})
            forms = recent.get("form", [])
            dates = recent.get("filingDate", [])
            candidates = [
                _dt.date.fromisoformat(dates[i])
                for i, f in enumerate(forms)
                if f in ("424B4", "424B1", "424B3", "EFFECT", "S-1")
            ]
            return min(candidates) if candidates else None
        except Exception:
            return None
