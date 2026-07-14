import datetime as dt

from catalyst_calendar.schema import CatalystEvent, CatalystType, Confidence, utcnow_iso
from catalyst_calendar.store import EventStore


def _ev(date, confidence=Confidence.ESTIMATED, desc="ACME IPO lockup expiration",
        asset="ACME", source="https://sec.gov/x", key_extra=None):
    now = utcnow_iso()
    extra = {}
    if key_extra:
        extra = {**key_extra, "_key_extra": list(key_extra)}
    return CatalystEvent(
        date=date, type=CatalystType.IPO_LOCKUP, asset_or_universe=asset,
        description=desc, confidence=confidence, source_url=source,
        first_seen=now, last_verified=now, extra=extra,
    )


def test_insert_then_idempotent_rerun_keeps_count_stable():
    store = EventStore()
    ev = _ev("2026-12-15")
    store.upsert([ev])
    store.upsert([ev])  # identical rerun
    assert store.active_count() == 1
    assert store.total_count() == 1  # no history rows created


def test_date_move_supersedes_not_deletes():
    store = EventStore()
    store.upsert([_ev("2026-12-15")])
    store.upsert([_ev("2026-12-20")])  # date moved
    active = store.active_events()
    assert len(active) == 1
    assert active[0].date == "2026-12-20"
    # Old row preserved with a reason and a forward pointer.
    key = active[0].canonical_key()
    hist = store.history(key)
    assert len(hist) == 2
    superseded = [h for h in hist if h.superseded_by is not None]
    assert len(superseded) == 1
    assert superseded[0].date == "2026-12-15"
    assert superseded[0].supersede_reason == "SUPERSEDED_DATE_MOVED"


def test_estimate_confirmed_is_superseded_not_silently_promoted():
    store = EventStore()
    store.upsert([_ev("2026-12-15", confidence=Confidence.ESTIMATED)])
    store.upsert([_ev("2026-12-15", confidence=Confidence.CONFIRMED)])
    active = store.active_events()
    assert len(active) == 1
    assert active[0].confidence == "CONFIRMED"
    hist = store.history(active[0].canonical_key())
    old = [h for h in hist if h.superseded_by is not None][0]
    assert old.confidence == "ESTIMATED"
    assert old.supersede_reason == "SUPERSEDED_CONFIRMED"


def test_first_seen_preserved_across_supersede():
    store = EventStore()
    ev = _ev("2026-12-15")
    original_first_seen = ev.first_seen
    store.upsert([ev])
    store.upsert([_ev("2026-12-20")])
    active = store.active_events()[0]
    assert active.first_seen == original_first_seen  # provenance survived the move


def test_period_key_extra_keeps_recurring_events_distinct():
    store = EventStore()
    store.upsert([_ev("2026-01-07", asset="EIA", desc="EIA weekly petroleum",
                      key_extra={"period": "2026-01-07"})])
    store.upsert([_ev("2026-01-14", asset="EIA", desc="EIA weekly petroleum",
                      key_extra={"period": "2026-01-14"})])
    # Different periods => two distinct logical events, not a supersede.
    assert store.active_count() == 2
