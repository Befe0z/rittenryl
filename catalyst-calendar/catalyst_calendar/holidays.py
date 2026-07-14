"""US federal holiday calendar — enough to shift release schedules correctly.

EIA (Wed petroleum / Thu natgas) and CFTC COT (Fri) releases slip by one
business day when a federal holiday falls on or before the normal release day in
that week. Index reconstitution schedules also key off business days. This is a
dependency-free implementation (no ``holidays`` package) so the computed
schedules stay CONFIRMED without a network or extra install.
"""

from __future__ import annotations

import datetime as _dt
from functools import lru_cache


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> _dt.date:
    """n-th ``weekday`` (Mon=0) of month; n negative counts from the end."""
    if n > 0:
        d = _dt.date(year, month, 1)
        offset = (weekday - d.weekday()) % 7
        return d + _dt.timedelta(days=offset + 7 * (n - 1))
    # last weekday of month
    if month == 12:
        nxt = _dt.date(year + 1, 1, 1)
    else:
        nxt = _dt.date(year, month + 1, 1)
    d = nxt - _dt.timedelta(days=1)
    offset = (d.weekday() - weekday) % 7
    return d - _dt.timedelta(days=offset)


def _observed(d: _dt.date) -> _dt.date:
    """Federal 'observed' rule: Sat->Fri, Sun->Mon."""
    if d.weekday() == 5:
        return d - _dt.timedelta(days=1)
    if d.weekday() == 6:
        return d + _dt.timedelta(days=1)
    return d


@lru_cache(maxsize=64)
def federal_holidays(year: int) -> frozenset[_dt.date]:
    h = set()
    h.add(_observed(_dt.date(year, 1, 1)))                 # New Year's Day
    h.add(_nth_weekday(year, 1, 0, 3))                     # MLK (3rd Mon Jan)
    h.add(_nth_weekday(year, 2, 0, 3))                     # Presidents' (3rd Mon Feb)
    h.add(_nth_weekday(year, 5, 0, -1))                    # Memorial (last Mon May)
    if year >= 2021:
        h.add(_observed(_dt.date(year, 6, 19)))            # Juneteenth
    h.add(_observed(_dt.date(year, 7, 4)))                 # Independence Day
    h.add(_nth_weekday(year, 9, 0, 1))                     # Labor (1st Mon Sep)
    h.add(_nth_weekday(year, 10, 0, 2))                    # Columbus (2nd Mon Oct)
    h.add(_observed(_dt.date(year, 11, 11)))               # Veterans Day
    h.add(_nth_weekday(year, 11, 3, 4))                    # Thanksgiving (4th Thu Nov)
    h.add(_observed(_dt.date(year, 12, 25)))               # Christmas
    return frozenset(h)


def is_holiday(d: _dt.date) -> bool:
    return d in federal_holidays(d.year)


def is_business_day(d: _dt.date) -> bool:
    return d.weekday() < 5 and not is_holiday(d)


def next_business_day(d: _dt.date) -> _dt.date:
    d += _dt.timedelta(days=1)
    while not is_business_day(d):
        d += _dt.timedelta(days=1)
    return d


def shift_release(normal_day: _dt.date) -> _dt.date:
    """A scheduled release lands on ``normal_day`` unless that week contains a
    federal holiday on/before it, in which case it slips one business day.

    EIA/CFTC rule of thumb: a Mon-Wed(-Fri) holiday pushes the weekly release
    back a day. We model it as: if the normal day is itself a holiday, or any
    federal holiday falls in the Mon..normal_day span of that week, move to the
    next business day.
    """
    if not is_business_day(normal_day):
        return next_business_day(normal_day)
    monday = normal_day - _dt.timedelta(days=normal_day.weekday())
    span = [monday + _dt.timedelta(days=i) for i in range((normal_day - monday).days + 1)]
    if any(is_holiday(x) for x in span):
        return next_business_day(normal_day)
    return normal_day
