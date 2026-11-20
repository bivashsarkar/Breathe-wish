"""Dependency-free sliding-window rate limiting.

Suitable for a single-process hackathon deployment. For production, move the
same interface to Redis (or put a gateway in front of Flask).
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from ..utils.errors import ApiError


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        now = time.time()
        with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= now - window_seconds:
                bucket.popleft()
            if len(bucket) >= limit:
                return False
            bucket.append(now)
            return True

    def enforce(self, key: str, limit: int, window_seconds: int = 60) -> None:
        if not self.allow(key, limit, window_seconds):
            raise ApiError(
                429,
                "rate_limited",
                "Too many requests. Please wait a moment and try again.",
            )

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


rate_limiter = SlidingWindowLimiter()
