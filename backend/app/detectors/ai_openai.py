"""Independent second-opinion judge on the OpenAI Responses API."""
from __future__ import annotations

import json
import logging
import time
from functools import lru_cache
from typing import Any

import openai

from ..config import get_settings
from ..schemas import AIOpinion
from .ai_common import VERDICT_SCHEMA, JudgeInput, system_prompt

log = logging.getLogger(__name__)

PREFERRED = ("gpt-5.5", "gpt-5.4", "gpt-5.3", "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4o")
_model: str | None = None


@lru_cache
def _client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(api_key=get_settings().openai_api_key, max_retries=1, timeout=45.0)


def available() -> bool:
    return bool(get_settings().openai_api_key)


async def model() -> str:
    global _model
    if _model:
        return _model
    configured = get_settings().openai_model
    if configured:
        _model = configured
        return _model
    ids = {m.id async for m in _client().models.list()}
    _model = next((p for p in PREFERRED if p in ids), "gpt-4o")
    log.info("OpenAI judge model: %s", _model)
    return _model


async def judge(inp: JudgeInput) -> AIOpinion:
    started = time.perf_counter()
    content: list[dict[str, Any]] = [{"type": "input_text", "text": inp.user_text()}]
    shot = inp.screenshot_jpeg_b64()
    if shot:
        content.insert(0, {"type": "input_image", "image_url": f"data:image/jpeg;base64,{shot}"})
    m = await model()
    resp = await _client().responses.create(
        model=m,
        instructions=system_prompt(),
        input=[{"role": "user", "content": content}],
        text={"format": {"type": "json_schema", "name": "verdict", "schema": VERDICT_SCHEMA, "strict": True}},
    )
    data = json.loads(resp.output_text)
    return AIOpinion(
        provider="OpenAI",
        model=m,
        verdict=data["verdict"],
        confidence=max(0.0, min(1.0, float(data["confidence"]))),
        target_brand=data.get("target_brand_id") or data.get("target_brand_name"),
        asks_for=[a for a in data.get("asks_for", []) if a != "none"],
        reasons={"en": data.get("reasons_en", [])[:4], "ar": data.get("reasons_ar", [])[:4]},
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
