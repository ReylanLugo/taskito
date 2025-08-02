import os
from typing import Any
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings

def is_testing():
    """Check if we're in test mode"""
    return os.getenv("TESTING", "false").lower() == "true"

def get_key_func(request: Any) -> str:
    """Custom key function that returns an empty string (disabling rate limiting) in testing mode 
    or when rate limiting is disabled"""
    if is_testing() or not settings.rate_limit_enabled:
        # Empty string is treated as "no rate limiting"
        return ""
    # Otherwise use the regular remote address for rate limiting
    return get_remote_address(request)

# Initialize limiter
limiter = Limiter(
    key_func=get_key_func,
    headers_enabled=True,
    storage_uri=f"redis://{settings.redis_host}:{settings.redis_port}/LIMITS",
    strategy="fixed-window",
    default_limits=[f"{settings.rate_limit_requests}/{settings.rate_limit_window}"]
)