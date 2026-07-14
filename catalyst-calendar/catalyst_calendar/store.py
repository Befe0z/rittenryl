"""SQLite-backed event store with an append-only audit trail.

The store never destroys a fact. When a source reports that a catalyst's date
moved (or that an ``ESTIMATED`` date is now ``CONFIRMED``), the existing row is
*superseded* — flagged inactive with a reason and a pointer to the replacing
row — and a new active row is written. Reads default to the active set; the
full history stays queryable for the audit trail.

Idempotency contract
--------------------
:meth:`EventStore.upsert` keys off ``CatalystEvent.canonical_key`` (which is
independent of the mutable date). Re-running a source with unchanged data only
bumps ``last_verified`` on the existing active row, so the active event count is
stable across repeated refreshes.
"""

from __future__ import annotations

import datetime as _dt
import json
import sqlite3
from pathlib import Path
from typing import Iterable, Optional

from .schema import (
    SUPERSEDED_CONFIRMED,
    SUPERSEDED_DATE_MOVED,
    CatalystEvent,
    Confidence,
    utcnow_iso,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_key  TEXT    NOT NULL,
    date           TEXT    NOT NULL,
    type           TEXT    NOT NULL,
    asset_or_universe TEXT NOT NULL,
    description    TEXT    NOT NULL,
    confidence     TEXT    NOT NULL,
    source_url     TEXT    NOT NULL,
    first_seen     TEXT    NOT NULL,
    last_verified  TEXT    NOT NULL,
    superseded_by  TEXT,
    supersede_reason TEXT,
    active         INTEGER NOT NULL DEFAULT 1,
    extra          TEXT    NOT NULL DEFAULT '{}'
);
-- One active row per logical event; history rows (active=0) are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_active_key
    ON events(canonical_key) WHERE active = 1;
CREATE INDEX IF NOT EXISTS ix_events_date ON events(date);
CREATE INDEX IF NOT EXISTS ix_events_type ON events(type);
"""


class EventStore:
    def __init__(self, path: str | Path = ":memory:") -> None:
        self.path = str(path)
        self._conn = sqlite3.connect(self.path)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "EventStore":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # ------------------------------------------------------------------- writes
    def upsert(self, events: Iterable[CatalystEvent]) -> dict[str, int]:
        """Insert/update a batch idempotently. Returns a change summary."""
        stats = {"inserted": 0, "updated": 0, "superseded": 0, "unchanged": 0}
        cur = self._conn.cursor()
        for ev in events:
            key = ev.canonical_key()
            existing = cur.execute(
                "SELECT * FROM events WHERE canonical_key = ? AND active = 1", (key,)
            ).fetchone()

            if existing is None:
                self._insert_active(cur, ev, first_seen=ev.first_seen or utcnow_iso())
                stats["inserted"] += 1
                continue

            date_moved = existing["date"] != ev.date
            confidence_changed = existing["confidence"] != ev.confidence

            if not date_moved and not confidence_changed:
                # Idempotent path: nothing material changed. Refresh provenance
                # only (bump last_verified, allow source_url/extra to update).
                cur.execute(
                    "UPDATE events SET last_verified = ?, source_url = ?, extra = ? WHERE id = ?",
                    (utcnow_iso(), ev.source_url, json.dumps(ev.extra, sort_keys=True), existing["id"]),
                )
                stats["unchanged"] += 1
                continue

            # Something material changed → supersede, never overwrite.
            reason = self._supersede_reason(existing, ev, date_moved, confidence_changed)
            # Deactivate the old row FIRST so the partial unique index (one active
            # row per key) permits the replacement insert; then back-fill the
            # forward pointer once we know the new row's id. Preserve the original
            # first_seen so provenance survives the move.
            cur.execute(
                "UPDATE events SET active = 0, supersede_reason = ? WHERE id = ?",
                (reason, existing["id"]),
            )
            new_id = self._insert_active(cur, ev, first_seen=existing["first_seen"])
            cur.execute(
                "UPDATE events SET superseded_by = ? WHERE id = ?",
                (str(new_id), existing["id"]),
            )
            stats["superseded"] += 1
            stats["updated"] += 1
        self._conn.commit()
        return stats

    @staticmethod
    def _supersede_reason(existing, ev: CatalystEvent, date_moved: bool, confidence_changed: bool) -> str:
        promoted = (
            existing["confidence"] == Confidence.ESTIMATED.value
            and ev.confidence == Confidence.CONFIRMED.value
        )
        if promoted and not date_moved:
            return SUPERSEDED_CONFIRMED
        if promoted and date_moved:
            return f"{SUPERSEDED_CONFIRMED}+{SUPERSEDED_DATE_MOVED}"
        if date_moved:
            return SUPERSEDED_DATE_MOVED
        return f"CONFIDENCE:{existing['confidence']}->{ev.confidence}"

    def _insert_active(self, cur, ev: CatalystEvent, first_seen: str) -> int:
        now = utcnow_iso()
        cur.execute(
            """INSERT INTO events
               (canonical_key, date, type, asset_or_universe, description,
                confidence, source_url, first_seen, last_verified,
                superseded_by, supersede_reason, active, extra)
               VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,1,?)""",
            (
                ev.canonical_key(), ev.date, ev.type, ev.asset_or_universe,
                ev.description, ev.confidence, ev.source_url,
                first_seen, now, json.dumps(ev.extra, sort_keys=True),
            ),
        )
        return cur.lastrowid

    # ------------------------------------------------------------------- reads
    def _rows_to_events(self, rows) -> list[CatalystEvent]:
        out = []
        for r in rows:
            d = dict(r)
            d.pop("id", None)
            d.pop("active", None)
            out.append(CatalystEvent.from_row(d))
        return out

    def active_events(
        self,
        start: Optional[_dt.date] = None,
        end: Optional[_dt.date] = None,
        types: Optional[Iterable[str]] = None,
        assets: Optional[Iterable[str]] = None,
    ) -> list[CatalystEvent]:
        sql = "SELECT * FROM events WHERE active = 1"
        params: list = []
        if start is not None:
            sql += " AND date >= ?"
            params.append(start.isoformat())
        if end is not None:
            sql += " AND date <= ?"
            params.append(end.isoformat())
        if types:
            types = list(types)
            sql += f" AND type IN ({','.join('?' * len(types))})"
            params.extend(types)
        sql += " ORDER BY date ASC, type ASC"
        rows = self._conn.execute(sql, params).fetchall()
        events = self._rows_to_events(rows)
        if assets:
            wanted = {a.upper() for a in assets}
            events = [e for e in events if e.asset_or_universe.upper() in wanted]
        return events

    def history(self, canonical_key: str) -> list[CatalystEvent]:
        """Full audit trail (active + superseded) for one logical event."""
        rows = self._conn.execute(
            "SELECT * FROM events WHERE canonical_key = ? ORDER BY id ASC",
            (canonical_key,),
        ).fetchall()
        return self._rows_to_events(rows)

    def active_count(self) -> int:
        return self._conn.execute(
            "SELECT COUNT(*) FROM events WHERE active = 1"
        ).fetchone()[0]

    def total_count(self) -> int:
        return self._conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
