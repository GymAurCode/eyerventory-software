import time
import json
import os
from collections.abc import Callable


class TTLCache:
    """Small in-memory TTL cache to avoid repeated heavy calculations."""

    def __init__(self, ttl_seconds: int = 120):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, object]] = {}
        self._redis = None
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis

                self._redis = redis.from_url(redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    def get_or_set(self, key: str, builder: Callable[[], object]):
        if self._redis is not None:
            try:
                raw = self._redis.get(key)
                if raw:
                    return json.loads(raw)
                value = builder()
                self._redis.setex(key, self.ttl_seconds, json.dumps(value, default=str))
                return value
            except Exception:
                pass
        now = time.time()
        cached = self._store.get(key)
        if cached and now - cached[0] < self.ttl_seconds:
            return cached[1]
        value = builder()
        self._store[key] = (now, value)
        return value

    def clear(self) -> None:
        self._store.clear()
        if self._redis is not None:
            try:
                self._redis.flushdb()
            except Exception:
                pass

