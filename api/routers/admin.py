import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone
from api.database import get_db
from api.models import (
    Booking, BookingRequest, BookingStatus, ClubSettings,
    Court, RequestStatus, RequestType, ScheduleBlock, User,
)
from api.auth import require_admin
from api.schemas import (
    BookingOut, ClubSettingsOut, ClubSettingsUpdate,
    PlayerStat, ScheduleBlockCreate, ScheduleBlockOut, StatsOut,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _get_or_create_settings(db: AsyncSession) -> ClubSettings:
    result = await db.execute(select(ClubSettings))
    s = result.scalar_one_or_none()
    if not s:
        s = ClubSettings()
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


@router.get("/settings", response_model=ClubSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await _get_or_create_settings(db)
    return ClubSettingsOut(booking_window_days=s.booking_window_days, timezone=s.timezone)


@router.patch("/settings", response_model=ClubSettingsOut)
async def update_settings(
    body: ClubSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await _get_or_create_settings(db)
    if body.booking_window_days is not None:
        s.booking_window_days = body.booking_window_days
    if body.timezone is not None:
        s.timezone = body.timezone
    await db.commit()
    await db.refresh(s)
    return ClubSettingsOut(booking_window_days=s.booking_window_days, timezone=s.timezone)


@router.get("/schedule", response_model=list[ScheduleBlockOut])
async def list_schedule(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(ScheduleBlock).order_by(ScheduleBlock.time_start, ScheduleBlock.id)
    )
    return result.scalars().all()


@router.post("/schedule", response_model=ScheduleBlockOut, status_code=201)
async def create_schedule_block(
    body: ScheduleBlockCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    block = ScheduleBlock(
        title=body.title,
        court_id=body.court_id,
        time_start=body.time_start,
        time_end=body.time_end,
        recurrence=body.recurrence,
        weekdays=json.dumps(body.weekdays) if body.weekdays else None,
        specific_date=body.specific_date,
        is_release=body.is_release,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


@router.delete("/schedule/{block_id}", status_code=204)
async def delete_schedule_block(
    block_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(ScheduleBlock).where(ScheduleBlock.id == block_id))
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    await db.delete(block)
    await db.commit()


@router.get("/bookings", response_model=list[BookingOut])
async def list_all_bookings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.court),
            selectinload(Booking.booker),
            selectinload(Booking.partner),
        )
        .order_by(Booking.slot_start.desc())
    )
    return result.scalars().all()


@router.delete("/bookings/{booking_id}", status_code=204)
async def admin_cancel_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.request))
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = BookingStatus.cancelled
    booking.request.status = RequestStatus.cancelled
    await db.commit()


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    players_result = await db.execute(select(User).where(User.role == "player"))
    players = players_result.scalars().all()

    player_stats = []

    for player in players:
        week_result = await db.execute(
            select(func.count(Booking.id)).where(
                and_(
                    or_(Booking.booker_id == player.id, Booking.partner_id == player.id),
                    Booking.status == BookingStatus.confirmed,
                    Booking.created_at >= week_ago,
                )
            )
        )
        bookings_this_week = week_result.scalar() or 0

        total_result = await db.execute(
            select(func.count(Booking.id)).where(
                and_(
                    or_(Booking.booker_id == player.id, Booking.partner_id == player.id),
                    Booking.status.in_([BookingStatus.confirmed, BookingStatus.completed, BookingStatus.cancelled]),
                )
            )
        )
        total = total_result.scalar() or 0

        cancelled_result = await db.execute(
            select(func.count(Booking.id)).where(
                and_(
                    or_(Booking.booker_id == player.id, Booking.partner_id == player.id),
                    Booking.status == BookingStatus.cancelled,
                )
            )
        )
        cancelled = cancelled_result.scalar() or 0

        player_stats.append(PlayerStat(
            player=player,
            bookings_this_week=bookings_this_week,
            total_bookings=total,
            cancellation_rate=round(cancelled / total, 2) if total else 0.0,
        ))

    player_stats.sort(key=lambda x: x.bookings_this_week, reverse=True)

    thirty_ago = now - timedelta(days=30)
    courts_result = await db.execute(select(func.count(Court.id)).where(Court.is_active == True))
    active_courts = courts_result.scalar() or 3

    confirmed_30 = await db.execute(
        select(func.count(Booking.id)).where(
            and_(
                Booking.status.in_([BookingStatus.confirmed, BookingStatus.completed]),
                Booking.slot_start >= thirty_ago,
            )
        )
    )
    confirmed_30_count = confirmed_30.scalar() or 0
    possible_slots = 30 * 14 * active_courts
    utilization = round(confirmed_30_count / possible_slots, 2) if possible_slots else 0.0

    open_count_result = await db.execute(
        select(func.count(BookingRequest.id)).where(BookingRequest.type == RequestType.open)
    )
    named_count_result = await db.execute(
        select(func.count(BookingRequest.id)).where(BookingRequest.type == RequestType.named)
    )
    open_count = open_count_result.scalar() or 0
    named_count = named_count_result.scalar() or 0
    total_requests = open_count + named_count
    open_ratio = round(open_count / total_requests, 2) if total_requests else 0.0

    bookings_result = await db.execute(
        select(Booking).where(
            and_(
                Booking.status.in_([BookingStatus.confirmed, BookingStatus.completed]),
                Booking.slot_start >= thirty_ago,
            )
        )
    )
    peak_hours: dict[str, int] = {}
    days_abbr = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
    for b in bookings_result.scalars().all():
        key = f"{days_abbr[b.slot_start.weekday()]} {b.slot_start.strftime('%H:%M')}"
        peak_hours[key] = peak_hours.get(key, 0) + 1

    return StatsOut(
        player_stats=player_stats,
        utilization_rate=utilization,
        open_request_ratio=open_ratio,
        peak_hours=peak_hours,
    )
