"""Tiny CLI / demo:  python -m catalyst_calendar.cli --days 45

Refreshes the no-network sources (and network ones if keys are in the
environment) and prints the forward window. Network sources are skipped silently
when unreachable so the tool always produces the mechanical calendar.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import os

from .calendar import Calendar


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Structural-catalyst forward calendar")
    p.add_argument("--db", default=":memory:", help="SQLite path (default in-memory)")
    p.add_argument("--days", type=int, default=45, help="forward window in days")
    p.add_argument("--types", nargs="*", default=None, help="filter CatalystType values")
    p.add_argument("--assets", nargs="*", default=None, help="filter assets/universes")
    p.add_argument("--confirmed-only", action="store_true")
    p.add_argument("--no-network", action="store_true", help="skip network sources")
    args = p.parse_args(argv)

    cal = Calendar(args.db)
    api_keys = {"eia": os.environ.get("EIA_API_KEY"), "fred": os.environ.get("FRED_API_KEY")}
    cal.register_network_sources(api_keys=api_keys)

    for name, src in cal.sources.items():
        if src.requires_network and (args.no_network):
            continue
        try:
            cal.refresh(name, window_days=max(args.days, 400))
        except Exception as e:  # network source without key / unreachable
            print(f"# skipped {name}: {e}")

    up = cal.upcoming(
        days=args.days, types=args.types, assets=args.assets,
        include_estimated=not args.confirmed_only,
    )
    print(f"# {len(up)} catalysts in the next {args.days} days "
          f"(as of {_dt.date.today()})\n")
    print(f"{'DATE':<12} {'CONF':<17} {'TYPE':<18} {'ASSET':<16} DESCRIPTION")
    for e in up:
        print(f"{e.date:<12} {e.confidence:<17} {e.type:<18} {e.asset_or_universe:<16} {e.description}")
    cal.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
