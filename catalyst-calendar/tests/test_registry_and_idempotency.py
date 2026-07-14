import datetime as dt

from catalyst_calendar import Calendar


NO_NETWORK = ["opex", "eia", "cftc", "fomc", "index_rebalance"]


def test_register_network_sources():
    cal = Calendar()
    added = cal.register_network_sources(api_keys={})
    assert set(added) == {
        "eia", "fred", "cftc", "fomc", "edgar_lockups", "edgar_etf",
        "index_rebalance", "token_unlocks",
    }


def test_refresh_twice_is_idempotent_across_computed_sources():
    cal = Calendar()
    cal.register_network_sources(api_keys={})
    ws, wd = dt.date(2026, 1, 1), 365
    for name in NO_NETWORK:
        cal.refresh(name, window_start=ws, window_days=wd)
    n1 = cal.store.active_count()
    total1 = cal.store.total_count()
    for name in NO_NETWORK:
        cal.refresh(name, window_start=ws, window_days=wd)
    assert cal.store.active_count() == n1
    # No supersede/history churn on a clean rerun.
    assert cal.store.total_count() == total1


def test_upcoming_merges_sources_sorted():
    cal = Calendar()
    cal.register_network_sources(api_keys={})
    ws = dt.date(2026, 3, 1)
    for name in NO_NETWORK:
        cal.refresh(name, window_start=ws, window_days=30)
    up = cal.upcoming(days=30, as_of=ws)
    dates = [e.date for e in up]
    assert dates == sorted(dates)
    types = {e.type for e in up}
    # A March window should contain the quarterly opex and index rebalance.
    assert "OPEX_QUARTERLY" in types
    assert "INDEX_REBALANCE" in types
