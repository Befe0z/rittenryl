import datetime as dt

from catalyst_calendar.sources.opex import OpexSource, expiration_date, third_friday


def test_2026_triple_witching_matches_known_values():
    # Known 3rd-Friday quarterly (triple-witching) dates for 2026.
    assert third_friday(2026, 3) == dt.date(2026, 3, 20)
    assert third_friday(2026, 6) == dt.date(2026, 6, 19)
    assert third_friday(2026, 9) == dt.date(2026, 9, 18)
    assert third_friday(2026, 12) == dt.date(2026, 12, 18)


def test_monthly_third_fridays_spot_checks():
    assert third_friday(2026, 1) == dt.date(2026, 1, 16)
    assert third_friday(2026, 7) == dt.date(2026, 7, 17)
    assert third_friday(2025, 12) == dt.date(2025, 12, 19)


def test_good_friday_rolls_expiration_to_thursday():
    # Good Friday 2024 = 2024-03-29, which IS the 3rd Friday of March 2024.
    assert third_friday(2024, 3) == dt.date(2024, 3, 15)  # not affected (3rd Fri is 15th)
    # April 2003: 3rd Friday = Apr 18 2003, Good Friday = Apr 18 2003 -> roll to Thu 17.
    assert third_friday(2003, 4) == dt.date(2003, 4, 18)
    assert expiration_date(2003, 4) == dt.date(2003, 4, 17)


def test_quarterly_flagged_separately():
    src = OpexSource()
    evs = src.fetch(dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    quarterly = [e for e in evs if e.type == "OPEX_QUARTERLY"]
    monthly = [e for e in evs if e.type == "OPEX_MONTHLY"]
    assert len(quarterly) == 4  # Mar/Jun/Sep/Dec
    assert {e.date for e in quarterly} == {"2026-03-20", "2026-06-19", "2026-09-18", "2026-12-18"}
    # The quarterly months are NOT also emitted as plain monthlies.
    assert len(monthly) == 8
    assert all(e.confidence == "CONFIRMED" for e in evs)


def test_opex_needs_no_network():
    assert OpexSource().requires_network is False
