import datetime as dt

from catalyst_calendar import Calendar, CatalystEvent, CatalystType, Confidence
from catalyst_calendar.schema import utcnow_iso


def test_calendar_opex_refresh_is_idempotent():
    cal = Calendar()
    cal.refresh("opex", window_start=dt.date(2026, 1, 1), window_days=365)
    n1 = cal.store.active_count()
    cal.refresh("opex", window_start=dt.date(2026, 1, 1), window_days=365)
    n2 = cal.store.active_count()
    assert n1 == n2 == 12  # 12 monthly expirations in a year


def test_upcoming_sorted_and_filtered():
    cal = Calendar()
    cal.refresh("opex", window_start=dt.date(2026, 1, 1), window_days=365)
    up = cal.upcoming(days=200, as_of=dt.date(2026, 1, 1), types=["OPEX_QUARTERLY"])
    dates = [e.date for e in up]
    assert dates == sorted(dates)
    assert all(e.type == "OPEX_QUARTERLY" for e in up)
    assert dates[0] == "2026-03-20"


def test_estimated_never_appears_as_confirmed():
    cal = Calendar()
    now = utcnow_iso()
    est = CatalystEvent(
        date="2026-12-10", type=CatalystType.IPO_LOCKUP, asset_or_universe="SPCX",
        description="SPCX IPO lockup expiration (IPO+180d)",
        confidence=Confidence.ESTIMATED, source_url="https://sec.gov/x",
        first_seen=now, last_verified=now,
    )
    cal.store.upsert([est])
    # Confirmed-only view excludes it.
    confirmed_view = cal.upcoming(days=365, as_of=dt.date(2026, 1, 1), include_estimated=False)
    assert all(e.confidence == "CONFIRMED" for e in confirmed_view)
    assert not any(e.asset_or_universe == "SPCX" for e in confirmed_view)
    # Full view includes it, still tagged ESTIMATED (never silently promoted).
    full = cal.upcoming(days=365, as_of=dt.date(2026, 1, 1))
    spcx = [e for e in full if e.asset_or_universe == "SPCX"]
    assert len(spcx) == 1 and spcx[0].confidence == "ESTIMATED"


def test_asset_filter():
    cal = Calendar()
    cal.refresh("opex", window_start=dt.date(2026, 1, 1), window_days=120)
    up = cal.upcoming(days=120, as_of=dt.date(2026, 1, 1), assets=["US_LISTED_OPTIONS"])
    assert len(up) > 0
    up_none = cal.upcoming(days=120, as_of=dt.date(2026, 1, 1), assets=["NVDA"])
    assert up_none == []
