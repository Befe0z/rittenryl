"""Catalyst source registry.

The no-network core (:class:`~catalyst_calendar.sources.opex.OpexSource`) is
imported eagerly by the calendar. Network sources are constructed on demand via
:func:`build_network_sources` so that importing the package never requires
``requests`` or API keys.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from .base import Source


def build_network_sources(api_keys: dict) -> list["Source"]:
    """Instantiate every network-backed source.

    ``api_keys`` may contain ``eia`` and ``fred`` keys. Sources that need a key
    but don't have one are still constructed (so they appear in the registry)
    and will raise a clear error only when ``refresh``ed.
    """
    from .cftc import CftcCotSource
    from .edgar_etf import EdgarEtfSource
    from .edgar_lockups import EdgarLockupSource
    from .eia import EiaReleaseSource
    from .fomc import FomcSource
    from .fred import FredReleaseSource
    from .index_rebalance import IndexRebalanceSource
    from .token_unlocks import TokenUnlockSource

    return [
        EiaReleaseSource(api_key=api_keys.get("eia")),
        FredReleaseSource(api_key=api_keys.get("fred")),
        CftcCotSource(),
        FomcSource(),
        EdgarLockupSource(),
        EdgarEtfSource(),
        IndexRebalanceSource(),
        TokenUnlockSource(),
    ]
