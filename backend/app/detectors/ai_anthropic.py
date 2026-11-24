"""Primary AI judge on the Anthropic Messages API (multimodal, structured JSON output)."""
from __future__ import annotations

import json
import logging
import time
from functools import lru_cache
from typing import Any

import anthropic

from ..config import get_settings
from ..schemas import AIOpinion
from .ai_common import MESSAGE_SCHEMA, VERDICT_SCHEMA, JudgeInput, message_system_prompt, system_prompt

log = logging.getLogger(__name__)


@lru_cache
def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key, max_retries=1, timeout=45.0)


def available() -> bool:
    return bool(get_settings().anthropic_api_key)


async def _create(system: str, content: list[dict[str, Any]], schema: dict[str, Any], max_tokens: int) -> dict[str, Any]:
    s = get_settings()
    kwargs: dict[str, Any] = {
        "model": s.ai_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": content}],
        "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": schema}},
        "betas": ["server-side-fallback-2026-07-01"],
        "fallbacks": "default",
    }
    if s.ai_fast_mode:
        kwargs["speed"] = "fast"
    try:
        resp = await _client().beta.messages.create(**kwargs)
    except (anthropic.RateLimitError, anthropic.BadRequestError) as exc:
        if "speed" not in kwargs:
            raise
        log.info("retrying AI judge at standard speed: %s", type(exc).__name__)
        kwargs.pop("speed")
        resp = await _client().beta.messages.create(**kwargs)
    if resp.stop_reason == "refusal":
        raise RuntimeError("model declined")
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)


async def judge(inp: JudgeInput) -> AIOpinion:
    started = time.perf_counter()
    content: list[dict[str, Any]] = []
    shot = inp.screenshot_jpeg_b64()
    if shot:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": shot}})
    content.append({"type": "text", "text": inp.user_text()})
    data = await _create(system_prompt(), content, VERDICT_SCHEMA, 3000)
    return AIOpinion(
        provider="Anthropic",
        model=get_settings().ai_model,
        verdict=data["verdict"],
        confidence=max(0.0, min(1.0, float(data["confidence"]))),
        target_brand=data.get("target_brand_id") or data.get("target_brand_name"),
        asks_for=[a for a in data.get("asks_for", []) if a != "none"],
        reasons={"en": data.get("reasons_en", [])[:4], "ar": data.get("reasons_ar", [])[:4]},
        latency_ms=int((time.perf_counter() - started) * 1000),
    )


async def analyze_message(text: str) -> dict[str, Any]:
    return await _create(message_system_prompt(), [{"type": "text", "text": f"Message:\n{text[:4000]}"}], MESSAGE_SCHEMA, 2000)
