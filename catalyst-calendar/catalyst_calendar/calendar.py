"""The discretionary read/refresh facade.

``Calendar`` is the object a trader actually touches:

    cal = Calendar("catalysts.db")
    cal.refresh("opex")                      # compute-once, no network
    cal.upcoming(days=30, types=["OPEX_QUARTERLY"])

It owns a source registry (each source behind its own module) and the store. The
core (opex) works with zero configuration; network sources are registered lazily
so importing this module never requires ``requests`` or API keys.
"""

from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Iterable, Optional

from .schema import CatalystEvent
from .sources.base import Source
from .sources.opex import OpexSource
from .store import EventStore


class Calendar:
    def __init__(self, db_path: str | Path = ":memory:") -> None:
        self.store = EventStore(db_path)
        self._sources: dict[str, Source] = {}
        # The no-network core is always available.
        self.register(OpexSource())

    # ---------------------------------------------------------------- registry
    def register(self, source: Source) -> None:
        self._sources[source.name] = source

    def register_network_sources(self, api_keys: Optional[dict] = None) -> list[str]:
        """Opt-in registration of the network sources (kept out of __init__ so
        the core stays import-light). Returns the names registered."""
        from .sources import build_network_sources

        added = []
        for src in build_network_sources(api_keys or {}):
            self.register(src)
            added.append(src.name)
        return added

    @property
    def sources(self) -> dict[str, Source]:
        return dict(self._sources)

    # ----------------------------------------------------------------- refresh
    def refresh(
        self,
        name: str,
        window_start: Optional[_dt.date] = None,
        window_days: int = 400,
    ) -> dict[str, int]:
        if name not in self._sources:
            raise KeyError(f"unknown source {name!r}; registered: {sorted(self._sources)}")
        return self._sources[name].refresh(self.store, window_start, window_days)

    def refresh_all(self, include_network: bool = True, **kw) -> dict[str, dict]:
        out = {}
        for name, src in self._sources.items():
            if src.requires_network and not include_network:
                continue
            out[name] = self.refresh(name, **kw)
        return out

    # -------------------------------------------------------------------- read
    def upcoming(
        self,
        days: int = 30,
        types: Optional[Iterable[str]] = None,
        assets: Optional[Iterable[str]] = None,
        include_estimated: bool = True,
        as_of: Optional[_dt.date] = None,
    ) -> list[CatalystEvent]:
        """Forward window sorted by date.

        ``types``/``assets`` filter discretionarily. ``include_estimated=False``
        hides ``ESTIMATED`` rows for a confirmed-only view.
        """
        start = as_of or _dt.date.today()
        end = start + _dt.timedelta(days=days)
        events = self.store.active_events(start=start, end=end, types=types, assets=assets)
        if not include_estimated:
            events = [e for e in events if e.is_confirmed]
        return events

    def close(self) -> None:
        self.store.close()

    def __enter__(self) -> "Calendar":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
