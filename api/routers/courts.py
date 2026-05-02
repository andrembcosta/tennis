from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.database import get_db
from api.models import Court, User
from api.auth import require_admin
from api.schemas import CourtOut, CourtUpdate

router = APIRouter(prefix="/api/courts", tags=["courts"])


@router.get("", response_model=list[CourtOut])
async def list_courts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Court).order_by(Court.id))
    return result.scalars().all()


@router.patch("/{court_id}", response_model=CourtOut)
async def update_court(
    court_id: int,
    body: CourtUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Court).where(Court.id == court_id))
    court = result.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(court, field, value)
    await db.commit()
    await db.refresh(court)
    return court
