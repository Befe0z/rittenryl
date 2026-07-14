"""Shared HTTP client for network sources.

Centralizes the three things every source must get right:

* a **declared User-Agent** (SEC EDGAR and good citizenship require it),
* **rate limiting** (SEC asks for < 10 req/s aggregate; we default well under),
* **CA-bundle awareness** so it works behind the session's egress proxy
  (``REQUESTS_CA_BUNDLE`` is honored automatically by requests; we also accept
  an explicit bundle path).

Kept dependency-light: only ``requests``. No global session state, so tests can
inject a fake transport.
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

try:  # requests is the only third-party runtime dep
    import requests
except ImportError:  # pragma: no cover - surfaced clearly at first network use
    requests = None  # type: ignore

DEFAULT_USER_AGENT = os.environ.get(
    "CATALYST_USER_AGENT",
    "rittenryl-catalyst-calendar/1.0 (contact: feola.ben@gmail.com)",
)


class RateLimiter:
    """Simple minimum-interval limiter (single process)."""

    def __init__(self, min_interval_s: float) -> None:
        self.min_interval_s = min_interval_s
        self._last = 0.0

    def wait(self) -> None:
        if self.min_interval_s <= 0:
            return
        elapsed = time.monotonic() - self._last
        if elapsed < self.min_interval_s:
            time.sleep(self.min_interval_s - elapsed)
        self._last = time.monotonic()


class HttpClient:
    def __init__(
        self,
        user_agent: str = DEFAULT_USER_AGENT,
        min_interval_s: float = 0.2,  # <= 5 req/s, comfortably under SEC's 10
        timeout: float = 30.0,
        ca_bundle: Optional[str] = None,
        session: Any = None,
    ) -> None:
        if requests is None and session is None:
            raise RuntimeError(
                "The 'requests' package is required for network sources. "
                "pip install requests"
            )
        self.user_agent = user_agent
        self.timeout = timeout
        self.limiter = RateLimiter(min_interval_s)
        self.verify = ca_bundle or os.environ.get("REQUESTS_CA_BUNDLE") or True
        self._session = session or (requests.Session() if requests else None)

    def get_json(self, url: str, params: Optional[dict] = None, headers: Optional[dict] = None) -> Any:
        self.limiter.wait()
        h = {"User-Agent": self.user_agent, "Accept": "application/json"}
        if headers:
            h.update(headers)
        resp = self._session.get(
            url, params=params, headers=h, timeout=self.timeout, verify=self.verify
        )
        resp.raise_for_status()
        return resp.json()

    def get_text(self, url: str, params: Optional[dict] = None, headers: Optional[dict] = None) -> str:
        self.limiter.wait()
        h = {"User-Agent": self.user_agent}
        if headers:
            h.update(headers)
        resp = self._session.get(
            url, params=params, headers=h, timeout=self.timeout, verify=self.verify
        )
        resp.raise_for_status()
        return resp.text
