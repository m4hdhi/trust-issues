"""One background thread for hunter number-crunching, so the web server keeps most of the CPU and the interpreter lock."""
from __future__ import annotations

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from ..config import get_settings

_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="hunter")
_PAUSE_EVERY = 300 if get_settings().low_resource else 3000


async def offload(fn: Callable[..., Any], *args: Any) -> Any:
    return await asyncio.get_running_loop().run_in_executor(_pool, fn, *args)


def breathe(i: int) -> None:
    """Called inside long loops: a short sleep hands the interpreter lock back to the web server."""
    if i and i % _PAUSE_EVERY == 0:
        time.sleep(0.002)
