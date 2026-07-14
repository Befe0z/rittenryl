"""Offline tests for the network-backed sources.

Computed schedules (EIA/CFTC/FOMC/index) are exercised directly. Parser-based
sources (FRED, EDGAR) are fed recorded fixtures so the mapping logic is verified
without egress (which this sandbox blocks anyway).
"""

import datetime as dt

import pytest

from catalyst_calendar.holidays import shift_release
from catalyst_calendar.sources.cftc import CftcCotSource
from catalyst_calendar.sources.edgar_etf import EdgarEtfSource
from catalyst_calendar.sources.edgar_lockups import EdgarLockupSource, parse_lockup_terms
from catalyst_calendar.sources.eia import EiaReleaseSource
from catalyst_calendar.sources.fomc import FomcSource
from catalyst_calendar.sources.fred import FredReleaseSource
from catalyst_calendar.sources.index_rebalance import IndexRebalanceSource


# ---------------------------------------------------------------- EIA schedule
def test_eia_schedule_wed_thu_and_confirmed():
    src = EiaReleaseSource()
    evs = src.fetch(dt.date(2026, 1, 5), dt.date(2026, 1, 31))
    pet = [e for e in evs if e.extra["series"] == "petroleum"]
    gas = [e for e in evs if e.extra["series"] == "natural_gas"]
    assert pet and gas
    assert all(e.confidence == "CONFIRMED" for e in evs)
    # First full week of Jan 2026: Wed=Jan 7 (petroleum), Thu=Jan 8 (natgas).
    assert pet[0].date == "2026-01-07"
    assert gas[0].date == "2026-01-08"


def test_eia_holiday_shift():
    # Week of US Thanksgiving 2026 (Thu Nov 26). Petroleum normally Wed Nov 25;
    # natgas normally Thu Nov 26 (holiday) -> shifts to Fri Nov 27.
    assert shift_release(dt.date(2026, 11, 26)) == dt.date(2026, 11, 27)


def test_eia_anchor_uses_client(monkeypatch):
    class FakeClient:
        def get_json(self, url, params=None, headers=None):
            return {"response": {"data": [{"period": "2026-07-03"}]}}
    src = EiaReleaseSource(api_key="demo", client=FakeClient())
    assert src.latest_period("petroleum/stoc/wstk/data") == "2026-07-03"


def test_eia_anchor_none_without_key():
    assert EiaReleaseSource().latest_period("x") is None


# ---------------------------------------------------------------- CFTC schedule
def test_cftc_weekly_fridays():
    evs = CftcCotSource().fetch(dt.date(2026, 1, 5), dt.date(2026, 1, 31))
    assert all(e.asset_or_universe == "CFTC_COT" for e in evs)
    assert all(e.confidence == "CONFIRMED" for e in evs)
    # First Friday of the window Jan 9 2026.
    assert evs[0].date == "2026-01-09"


# ---------------------------------------------------------------------- FOMC
def test_fomc_2026_decisions_and_minutes():
    evs = FomcSource().fetch(dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    decisions = sorted(e.date for e in evs if e.extra["event"] == "decision")
    assert decisions == [
        "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
        "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
    ]
    # Minutes are decision + 21 days.
    minutes = {e.date for e in evs if e.extra["event"] == "minutes"}
    assert "2026-02-18" in minutes  # Jan 28 + 21d
    assert all(e.confidence == "CONFIRMED" for e in evs)


# ---------------------------------------------------------------------- FRED
def test_fred_parse_confirmed():
    payload = {
        "release_dates": [
            {"release_id": 10, "date": "2026-01-13"},
            {"release_id": 10, "date": "2026-02-11"},
            {"release_id": 10, "date": "2020-01-01"},  # out of window, dropped
        ]
    }
    src = FredReleaseSource(api_key="demo")
    evs = src.parse(payload, 10, "CPI", "US CPI release", dt.date(2026, 1, 1), dt.date(2026, 6, 30))
    assert len(evs) == 2
    assert all(e.confidence == "CONFIRMED" and e.asset_or_universe == "CPI" for e in evs)


def test_fred_requires_key():
    with pytest.raises(RuntimeError):
        FredReleaseSource().fetch(dt.date(2026, 1, 1), dt.date(2026, 2, 1))


# ------------------------------------------------------------- EDGAR lockups
def test_lockup_estimate_is_ipo_plus_180_and_estimated():
    src = EdgarLockupSource()
    ev = src.estimate("SPCX", ipo_date=dt.date(2026, 6, 10))
    assert ev.date_obj == dt.date(2026, 6, 10) + dt.timedelta(days=180)
    assert ev.confidence == "ESTIMATED"
    assert ev.type == "IPO_LOCKUP"
    assert "ESTIMATED" in ev.description


def test_lockup_never_confirmed_even_with_prospectus():
    text = ("Subject to certain exceptions, we and our officers agreed not to sell "
            "for a period of 180 days. 25% of the shares may be released early after "
            "90 days if the closing price exceeds 133% of the offering price.")
    terms = parse_lockup_terms(text)
    assert terms["days"] == 180
    assert terms["staggered"] is True
    assert terms["early_release"] is True
    ev = EdgarLockupSource().estimate("ACME", "2026-01-02", prospectus_text=text)
    assert ev.confidence == "ESTIMATED"  # parsing never promotes to CONFIRMED
    assert ev.extra["staggered"] and ev.extra["early_release"]


def test_lockup_fetch_from_watchlist_window():
    src = EdgarLockupSource(watchlist=[{"ticker": "SPCX", "ipo_date": "2026-06-10"}])
    inside = src.fetch(dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    assert len(inside) == 1 and inside[0].asset_or_universe == "SPCX"
    outside = src.fetch(dt.date(2026, 1, 1), dt.date(2026, 6, 1))
    assert outside == []


# ---------------------------------------------------------------- EDGAR ETF
def test_etf_parse_485_estimated_and_19b4_pending():
    payload = {"hits": {"hits": [
        {"_id": "0001-25-000001:doc.htm", "_source": {
            "file_date": "2026-02-01", "display_names": ["HYPE Fund Trust (CIK 0001999)"],
            "cik": "1999"}},
    ]}}
    src = EdgarEtfSource()
    ev485 = src.parse(payload, "HYPE", "485BPOS", dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    assert ev485 and ev485[0].confidence == "ESTIMATED"
    assert ev485[0].date == "2026-04-02"  # filed + 60d
    ev19 = src.parse(payload, "HYPE", "19b-4", dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    assert ev19 and ev19[0].confidence == "ANNOUNCED_PENDING"


# ------------------------------------------------------------ index rebalance
def test_index_rebalance_schedule_confirmed():
    evs = IndexRebalanceSource().fetch(dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    sp = [e for e in evs if "S&P" in e.asset_or_universe]
    russ = [e for e in evs if "Russell" in e.asset_or_universe]
    ndx = [e for e in evs if "Nasdaq" in e.asset_or_universe]
    assert len(sp) == 4  # quarterly
    assert {e.date for e in sp} == {"2026-03-20", "2026-06-19", "2026-09-18", "2026-12-18"}
    assert russ[0].date == "2026-06-26"  # last Friday of June 2026
    assert ndx[0].date == "2026-12-18"
    assert all(e.confidence == "CONFIRMED" for e in evs)
    # Announcement scrape is stubbed (no fabricated names).
    assert IndexRebalanceSource().fetch_announcements(dt.date(2026, 1, 1), dt.date(2026, 12, 31)) == []
