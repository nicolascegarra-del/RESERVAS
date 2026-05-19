"""Rate limiting con slowapi (wrapper de limits sobre FastAPI)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
