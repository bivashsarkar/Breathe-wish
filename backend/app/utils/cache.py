"""A tiny thread-safe in-memory TTL cache.

The dashboard and the AI assistant read the same upstream data. Caching keeps
Open-Meteo calls low, keeps responses fast and protects the free upstream tier.
A multi-process deployment should swap this for Redis; the interface is small
on purpose.
"""

from __future__ import annotations

import copy
import threading
import time
from typing import Any


class TTLCache:
    def __init__(self, max_items: int = 256) -> None:
        self._items: dict[str, tuple[float, Any]] = {}
        self._lock = threading.RLock()
        self._max_items = max_items

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._items.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= time.time():
                self._items.pop(key, None)
                return None
            return copy.deepcopy(value)

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        with self._lock:
            if len(self._items) >= self._max_items:
                self._purge_expired()
            if len(self._items) >= self._max_items:
                oldest_key = next(iter(self._items))
                self._items.pop(oldest_key, None)
            self._items[key] = (time.time() + max(1, ttl_seconds), copy.deepcopy(value))

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [key for key, (expires_at, _) in self._items.items() if expires_at <= now]
        for key in expired:
            self._items.pop(key, None)

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


air_cache = TTLCache(max_items=512)
geo_cache = TTLCache(max_items=512)
