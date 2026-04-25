"""
Schemas Pydantic para configuración de branding por tenant.
"""

import re

from pydantic import BaseModel, field_validator

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _validate_hex_color(v: str | None) -> str | None:
    if v is not None and not _HEX_COLOR_RE.match(v):
        raise ValueError("El color debe estar en formato hexadecimal (#RRGGBB).")
    return v


class TenantBrandingRead(BaseModel):
    """Branding público del tenant — devuelto en endpoints autenticados y públicos."""

    brand_name: str | None
    logo_url: str | None
    primary_color: str | None
    accent_color: str | None
    tagline: str | None


class TenantBrandingUpdate(BaseModel):
    """Payload para actualizar el branding de un tenant."""

    brand_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None
    tagline: str | None = None

    @field_validator("primary_color", "accent_color", mode="before")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        return _validate_hex_color(v)
