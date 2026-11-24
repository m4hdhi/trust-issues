"""In-process pub/sub for scan progress and live radar events (Server-Sent Events)."""
from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from typing import Any


class Channel:
    def __init__(self, history: int = 200) -> None:
        self.history: deque[tuple[str, Any]] = deque(maxlen=history)
        self.subscribers: set[asyncio.Queue] = set()
        self.closed = False

    def publish(self, event: str, data: Any) -> None:
        self.history.append((event, data))
        for q in list(self.subscribers):
            q.put_nowait((event, data))

    def close(self) -> None:
        self.closed = True
        for q in list(self.subscribers):
            q.put_nowait(("__close__", None))

    def subscribe(self, replay: bool = True) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        if replay:
            for item in self.history:
                q.put_nowait(item)
        if self.closed:
            q.put_nowait(("__close__", None))
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)


_channels: dict[str, Channel] = defaultdict(Channel)


def channel(name: str) -> Channel:
    return _channels[name]


def drop(name: str) -> None:
    _channels.pop(name, None)
