"""
Router de preferencias de usuario.

  GET   /me/preferences  → devuelve la config de widgets del usuario actual
  PATCH /me/preferences  → guarda la config de widgets
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.user_preference import UserPreference

router = APIRouter(tags=["Preferencias"])

CurrentUserDep = Annotated[User, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

_ALL_WIDGETS = [
    "stat_units",
    "stat_reservations",
    "stat_guests",
    "stat_occupancy",
    "docs_alerts",
]

_DEFAULT_CONFIG: dict = {"visible_widgets": _ALL_WIDGETS}


class WidgetConfig(BaseModel):
    visible_widgets: list[str]


class PreferenceRead(BaseModel):
    widget_config: WidgetConfig


class PreferenceUpdate(BaseModel):
    widget_config: WidgetConfig


def _parse_config(raw: dict | None) -> WidgetConfig:
    cfg = raw or _DEFAULT_CONFIG
    widgets = cfg.get("visible_widgets", _ALL_WIDGETS)
    # Filtrar claves inválidas (forward-compatibility)
    valid = [w for w in widgets if w in _ALL_WIDGETS]
    return WidgetConfig(visible_widgets=valid)


@router.get("/me/preferences", response_model=PreferenceRead)
async def get_preferences(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> PreferenceRead:
    result = await session.exec(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.first()
    return PreferenceRead(widget_config=_parse_config(pref.widget_config if pref else None))


@router.patch("/me/preferences", response_model=PreferenceRead)
async def update_preferences(
    data: PreferenceUpdate,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> PreferenceRead:
    result = await session.exec(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.first()
    new_config = data.widget_config.model_dump()
    if pref:
        pref.widget_config = new_config
        pref.updated_at = datetime.utcnow()
        session.add(pref)
    else:
        pref = UserPreference(user_id=current_user.id, widget_config=new_config)
        session.add(pref)
    await session.commit()
    await session.refresh(pref)
    return PreferenceRead(widget_config=_parse_config(pref.widget_config))
