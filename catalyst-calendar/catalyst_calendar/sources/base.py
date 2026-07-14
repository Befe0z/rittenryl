"""Source interface. Every catalyst source is a small object that knows how to
produce a batch of :class:`CatalystEvent` for a forward window.

A source is intentionally *pure-ish*: :meth:`fetch` returns events and does not
touch the store. :meth:`refresh` wires ``fetch`` into a store (idempotent upsert)
and is what the scheduler/CLI calls. This keeps every source unit-testable by
asserting on the returned events without a database.
"""

from __future__ import annotations

import abc
import datetime as _dt
from typing import Optional

from ..schema import CatalystEvent
from ..store import EventStore


class Cadence:
    """Suggested refresh cadence (days). The calendar's scheduler uses these as
    a hint; nothing forces a caller's hand."""

    ONCE = 0            # compute-once (opex): recompute only to extend the window
    DAILY = 1
    WEEKLY = 7
    ON_FILING_SWEEP = -1  # event-driven (EDGAR new-filing sweep)


class Source(abc.ABC):
    #: stable short name, used in CLI/logging and to scope refreshes
    name: str = "base"
    #: default suggested cadence in days (see :class:`Cadence`)
    cadence: int = Cadence.WEEKLY
    #: True if the source performs network I/O (so offline runs can skip it)
    requires_network: bool = True

    @abc.abstractmethod
    def fetch(self, window_start: _dt.date, window_end: _dt.date) -> list[CatalystEvent]:
        """Return events with a date in ``[window_start, window_end]``."""

    def refresh(
        self,
        store: EventStore,
        window_start: Optional[_dt.date] = None,
        window_days: int = 400,
    ) -> dict[str, int]:
        """Fetch the forward window and upsert idempotently into ``store``."""
        start = window_start or _dt.date.today()
        end = start + _dt.timedelta(days=window_days)
        events = self.fetch(start, end)
        return store.upsert(events)
