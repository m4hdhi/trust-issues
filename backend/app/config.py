import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        str_strip_whitespace=True,
    )

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    serpapi_key: str = ""
    google_safe_browsing_key: str = ""
    virustotal_key: str = ""
    urlscan_key: str = ""
    urlhaus_auth_key: str = ""
    telegram_bot_token: str = ""

    low_resource: bool = False
    console_password: str = "change-me"
    public_base_url: str = "http://localhost:8000"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'trust_issues.db'}"

    ai_model: str = "claude-opus-5-5"
    ai_fast_mode: bool = True
    openai_model: str = ""

    media_dir: Path = BACKEND_DIR / "media"
    cache_dir: Path = BACKEND_DIR / "cache"
    web_dist: Path = ROOT_DIR / "web" / "dist"

    render_timeout_s: float = 20.0
    enable_hunters: bool = True
    certstream_url: str = "wss://certstream.calidog.io/"
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_subject: str = "mailto:abuse@trust-issues.app"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = ""


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    hosted_url = os.environ.get("RENDER_EXTERNAL_URL")
    if hosted_url and s.public_base_url.startswith("http://localhost"):
        s.public_base_url = hosted_url
    s.media_dir.mkdir(parents=True, exist_ok=True)
    (s.media_dir / "shots").mkdir(exist_ok=True)
    (s.media_dir / "cards").mkdir(exist_ok=True)
    s.cache_dir.mkdir(parents=True, exist_ok=True)
    return s
