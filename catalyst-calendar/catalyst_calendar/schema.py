"""Normalized event schema and enums for the structural-catalyst calendar.

Every catalyst — an options expiration, an EIA release, an IPO lockup — is
reduced to a single :class:`CatalystEvent`. The schema is deliberately flat so
it maps cleanly onto a SQLite row or a parquet column and so the discretionary
filtering interface (`calendar.upcoming`) never has to special-case a source.

Design rules baked into this module (all from the build spec):

* **Confidence is explicit and never silently promoted.** An estimated lockup
  (IPO + 180d) is born ``ESTIMATED`` and stays that way until a filing/press
  release confirms it, at which point a *new* row supersedes it.
* **Every event has a stable identity** (:meth:`CatalystEvent.canonical_key`)
  derived from source-stable attributes, NOT from the date. That is what makes
  refresh idempotent: re-running a source produces the same keys, and a moved
  date updates the existing logical event instead of inserting a duplicate.
"""

from __future__ import annotations

import datetime as _dt
import enum
import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Optional


class Confidence(str, enum.Enum):
    """How much we trust the ``date`` on an event.

    ``str`` mixin so the value serializes to plain text in SQLite/JSON/markdown.
    """

    #: Published/official date straight from the source.
    CONFIRMED = "CONFIRMED"
    #: Computed or defaulted (e.g. lockup = IPO + 180d). Discretionary only.
    ESTIMATED = "ESTIMATED"
    #: A change has been announced but the effective date is not yet final
    #: (e.g. an index add/delete announced days before the rebalance).
    ANNOUNCED_PENDING = "ANNOUNCED_PENDING"


class CatalystType(str, enum.Enum):
    """The structural-catalyst taxonomy, in the spec's build order."""

    OPEX_MONTHLY = "OPEX_MONTHLY"
    OPEX_QUARTERLY = "OPEX_QUARTERLY"  # triple-witching
    MACRO_RELEASE = "MACRO_RELEASE"
    IPO_LOCKUP = "IPO_LOCKUP"
    ETF_EVENT = "ETF_EVENT"
    INDEX_REBALANCE = "INDEX_REBALANCE"
    TOKEN_UNLOCK = "TOKEN_UNLOCK"


# A sentinel used in supersede reasons so the audit trail is greppable, mirroring
# the user's existing SUPERSEDED_BAD_DATA discipline.
SUPERSEDED_BAD_DATA = "SUPERSEDED_BAD_DATA"
SUPERSEDED_DATE_MOVED = "SUPERSEDED_DATE_MOVED"
SUPERSEDED_CONFIRMED = "SUPERSEDED_CONFIRMED"  # estimate replaced by confirmed date


def _to_iso(d: _dt.date | str) -> str:
    if isinstance(d, _dt.date):
        return d.isoformat()
    # Validate/normalize a string date.
    return _dt.date.fromisoformat(str(d)[:10]).isoformat()


@dataclass
class CatalystEvent:
    """One forward-calendar catalyst.

    The persisted columns are exactly the spec's normalized schema plus a
    ``canonical_key`` (identity for idempotency) and ``supersede_reason``.
    """

    date: str  # ISO YYYY-MM-DD — the catalyst date
    type: str  # CatalystType value
    asset_or_universe: str  # ticker, series id, or index/universe name
    description: str
    confidence: str  # Confidence value
    source_url: str
    first_seen: str  # ISO timestamp (UTC)
    last_verified: str  # ISO timestamp (UTC)
    superseded_by: Optional[str] = None  # canonical_key of the replacing row, if any
    supersede_reason: Optional[str] = None
    # Free-form provenance the discretionary reader may want (e.g. staggered
    # lockup notes, CIK, dataset id). Never used for identity.
    extra: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.date = _to_iso(self.date)
        if isinstance(self.type, CatalystType):
            self.type = self.type.value
        if isinstance(self.confidence, Confidence):
            self.confidence = self.confidence.value
        if self.confidence not in Confidence._value2member_map_:
            raise ValueError(f"unknown confidence: {self.confidence!r}")

    # ------------------------------------------------------------------ identity
    def canonical_key(self) -> str:
        """Stable identity independent of the (mutable) date.

        Two refreshes of the same logical event MUST produce the same key so an
        upsert updates in place. The key intentionally excludes ``date`` and
        ``confidence`` — those are the mutable facts an event can change without
        becoming a different event. It also excludes any ``extra`` field unless
        a source opts in via ``extra['_key_extra']`` (a list of extra keys that
        are part of identity, e.g. an EIA period so weekly releases stay
        distinct).
        """
        parts = [self.type, self.asset_or_universe.upper().strip(), self.description.strip().lower()]
        for k in self.extra.get("_key_extra", []):
            parts.append(f"{k}={self.extra.get(k)}")
        raw = "|".join(str(p) for p in parts)
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]

    @property
    def is_confirmed(self) -> bool:
        return self.confidence == Confidence.CONFIRMED.value

    @property
    def date_obj(self) -> _dt.date:
        return _dt.date.fromisoformat(self.date)

    # -------------------------------------------------------------- (de)serialize
    def to_row(self) -> dict[str, Any]:
        row = asdict(self)
        row["canonical_key"] = self.canonical_key()
        row["extra"] = json.dumps(row["extra"], sort_keys=True)
        return row

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "CatalystEvent":
        data = dict(row)
        data.pop("canonical_key", None)
        extra = data.get("extra")
        if isinstance(extra, str):
            data["extra"] = json.loads(extra) if extra else {}
        return cls(**{k: data[k] for k in _FIELDS if k in data})


_FIELDS = {f for f in CatalystEvent.__dataclass_fields__}  # noqa: E305


def utcnow_iso() -> str:
    """UTC timestamp for first_seen/last_verified.

    Kept in one place so tests can monkeypatch a deterministic clock.
    """
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()
