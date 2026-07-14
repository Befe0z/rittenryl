"""Structural-catalyst forward calendar.

A refreshable lookahead of *non-economic / structural* catalyst dates — where a
forced or mechanical actor trades regardless of price. Not a signal generator;
a lookahead of known dates for discretionary filtering.
"""

from .calendar import Calendar
from .schema import CatalystEvent, CatalystType, Confidence

__all__ = ["Calendar", "CatalystEvent", "CatalystType", "Confidence"]
__version__ = "0.1.0"
