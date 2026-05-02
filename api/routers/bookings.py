import json
from datetime import datetime, timedelta, timezone, time
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from api.database import get_db
from api.models import (
    Booking, BookingRequest, BookingRequestInvite, BookingStatus,
    ClubSettings, Court, InviteStatus, RequestStatus,
    RequestType, ScheduleBlock, User,
)
from api.auth import get_current_user
from api.schemas import BookingConfirm, BookingOut, BookingRequestCreate, BookingRequestOut, SlotAvailability
from api import email as email_service

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

MAX_PENDING = 3
SLOT_DURATION = timedelta(hours=1)


async def _get_settings(db: AsyncSession) -> ClubSettings:
    result = await db.execute(select(ClubSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = ClubSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


def _t2m_s(t: time) -> int:
    """Start time as minutes; time(0,0) = 0 (start of day)."""
    return t.hour * 60 + t.minute


def _t2m_e(t: time) -> int:
    """End time as minutes; time(0,0) = 1440 (end of day/midnight)."""
    m = t.hour * 60 + t.minute
    return 24 * 60 if m == 0 else m


def _times_overlap(s1: time, e1: time, s2: time, e2: time) -> bool:
    s1m, e1m = _t2m_s(s1), _t2m_e(e1)
    s2m, e2m = _t2m_s(s2), _t2m_e(e2)
    if s1m >= e1m:
        # Overnight block (e.g. 22:00–07:00): covers [s1m,1440) ∪ [0,e1m)
        return e2m > s1m or s2m < e1m
    return s1m < e2m and e1m > s2m


async def _available_courts(
    db: AsyncSession, slot_start: datetime, slot_end: datetime
) -> list[Court]:
    result = await db.execute(select(Court).where(Court.is_active == True))
    all_courts = result.scalars().all()

    blocks_result = await db.execute(select(ScheduleBlock))
    all_blocks = blocks_result.scalars().all()

    settings = await _get_settings(db)
    tz = ZoneInfo(settings.timezone)

    # Always compare against local time so block definitions (in local time) are correct
    local_start = slot_start.astimezone(tz) if slot_start.tzinfo else slot_start
    local_end = slot_end.astimezone(tz) if slot_end.tzinfo else slot_end

    slot_date = local_start.date()
    slot_weekday = slot_date.weekday()
    slot_t_start = local_start.time().replace(tzinfo=None)
    slot_t_end = local_end.time().replace(tzinfo=None)

    blocked_ids: set = set()   # int court_id or None (= all courts)
    released_ids: set = set()

    for blk in all_blocks:
        if not _times_overlap(blk.time_start, blk.time_end, slot_t_start, slot_t_end):
            continue

        applies = False
        if blk.recurrence == "none":
            applies = blk.specific_date == slot_date
        elif blk.recurrence == "daily":
            applies = True
        elif blk.recurrence == "weekly":
            wdays = json.loads(blk.weekdays or "[]")
            applies = slot_weekday in wdays

        if not applies:
            continue

        (released_ids if blk.is_release else blocked_ids).add(blk.court_id)

    def is_court_blocked(court: Court) -> bool:
        if court.id not in blocked_ids and None not in blocked_ids:
            return False
        return court.id not in released_ids and None not in released_ids

    taken = await db.execute(
        select(Booking.court_id).where(
            and_(
                Booking.slot_start == slot_start,
                Booking.status == BookingStatus.confirmed,
            )
        )
    )
    taken_ids = {r for r in taken.scalars()}

    return [c for c in all_courts if not is_court_blocked(c) and c.id not in taken_ids]


async def _cancel_other_pending(db: AsyncSession, user_id: int, exclude_request_id: int):
    result = await db.execute(
        select(BookingRequest).where(
            and_(
                BookingRequest.booker_id == user_id,
                BookingRequest.status == RequestStatus.pending,
                BookingRequest.id != exclude_request_id,
            )
        )
    )
    for req in result.scalars().all():
        req.status = RequestStatus.cancelled


@router.get("/calendar", response_model=list[SlotAvailability])
async def get_calendar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    club_settings = await _get_settings(db)
    tz = ZoneInfo(club_settings.timezone)
    now = datetime.now(tz)

    total_courts_result = await db.execute(
        select(func.count(Court.id)).where(Court.is_active == True)
    )
    total_courts = total_courts_result.scalar() or 0

    slots = []

    for day_offset in range(club_settings.booking_window_days):
        day = (now + timedelta(days=day_offset)).date()
        slot_start = datetime.combine(day, time(0, 0), tzinfo=tz)
        day_end = datetime.combine(day, time(23, 0), tzinfo=tz)

        while slot_start + SLOT_DURATION <= day_end:
            slot_end = slot_start + SLOT_DURATION
            if slot_start > now:
                available = await _available_courts(db, slot_start, slot_end)

                my_booking_row = await db.execute(
                    select(Booking)
                    .options(
                        selectinload(Booking.court),
                        selectinload(Booking.booker),
                        selectinload(Booking.partner),
                    )
                    .where(
                        and_(
                            Booking.slot_start == slot_start,
                            Booking.status == BookingStatus.confirmed,
                            or_(Booking.booker_id == current_user.id, Booking.partner_id == current_user.id),
                        )
                    )
                )
                my_booking = my_booking_row.scalar_one_or_none()

                if not available and not my_booking:
                    slot_start = slot_end
                    continue

                open_reqs = await db.execute(
                    select(BookingRequest)
                    .options(
                        selectinload(BookingRequest.booker),
                        selectinload(BookingRequest.invites).selectinload(BookingRequestInvite.invited_player),
                    )
                    .where(
                        and_(
                            BookingRequest.slot_start == slot_start,
                            BookingRequest.type == RequestType.open,
                            BookingRequest.status == RequestStatus.pending,
                        )
                    )
                )

                invited_reqs = await db.execute(
                    select(BookingRequest)
                    .options(
                        selectinload(BookingRequest.booker),
                        selectinload(BookingRequest.invites).selectinload(BookingRequestInvite.invited_player),
                    )
                    .join(BookingRequestInvite, BookingRequestInvite.request_id == BookingRequest.id)
                    .where(
                        and_(
                            BookingRequest.slot_start == slot_start,
                            BookingRequest.type == RequestType.named,
                            BookingRequest.status == RequestStatus.pending,
                            BookingRequestInvite.invited_player_id == current_user.id,
                            BookingRequestInvite.status == InviteStatus.pending,
                        )
                    )
                )

                my_named_reqs = await db.execute(
                    select(BookingRequest)
                    .options(
                        selectinload(BookingRequest.booker),
                        selectinload(BookingRequest.invites).selectinload(BookingRequestInvite.invited_player),
                    )
                    .where(
                        and_(
                            BookingRequest.slot_start == slot_start,
                            BookingRequest.type == RequestType.named,
                            BookingRequest.status == RequestStatus.pending,
                            BookingRequest.booker_id == current_user.id,
                        )
                    )
                )

                slots.append(SlotAvailability(
                    slot_start=slot_start,
                    slot_end=slot_end,
                    available_courts=available,
                    open_requests=list(open_reqs.scalars().all()),
                    invited_requests=list(invited_reqs.scalars().all()),
                    my_named_requests=list(my_named_reqs.scalars().all()),
                    my_booking=my_booking,
                    total_courts=total_courts,
                ))
            slot_start = slot_end

    return slots


@router.post("/requests", response_model=BookingRequestOut, status_code=201)
async def create_request(
    body: BookingRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    if body.slot_start <= now:
        raise HTTPException(status_code=400, detail="Slot must be in the future")

    pending_count = await db.execute(
        select(BookingRequest).where(
            and_(
                BookingRequest.booker_id == current_user.id,
                BookingRequest.status == RequestStatus.pending,
            )
        )
    )
    if len(pending_count.scalars().all()) >= MAX_PENDING:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PENDING} pending requests allowed")

    confirmed = await db.execute(
        select(Booking).where(
            and_(
                or_(Booking.booker_id == current_user.id, Booking.partner_id == current_user.id),
                Booking.status == BookingStatus.confirmed,
                Booking.slot_end > now,
            )
        )
    )
    if confirmed.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a confirmed upcoming booking")

    tz = ZoneInfo("America/Sao_Paulo")
    now_sp = datetime.now(tz).replace(tzinfo=None)
    if current_user.locked_until and now_sp < current_user.locked_until:
        until = current_user.locked_until.strftime("%d/%m as %H:%M")
        raise HTTPException(status_code=400, detail=f"Voce cancelou uma reserva de ultima hora. Novas reservas liberadas apos {until}")

    slot_end = body.slot_start + SLOT_DURATION

    req = BookingRequest(
        booker_id=current_user.id,
        slot_start=body.slot_start,
        slot_end=slot_end,
        type=body.type,
        status=RequestStatus.pending,
    )
    db.add(req)
    await db.flush()

    if body.type == RequestType.named:
        if not body.invited_player_ids:
            raise HTTPException(status_code=400, detail="Named request requires at least one invited player")
        for pid in body.invited_player_ids:
            db.add(BookingRequestInvite(request_id=req.id, invited_player_id=pid))

    await db.commit()
    await db.refresh(req)

    result = await db.execute(
        select(BookingRequest)
        .options(
            selectinload(BookingRequest.booker),
            selectinload(BookingRequest.invites).selectinload(BookingRequestInvite.invited_player),
        )
        .where(BookingRequest.id == req.id)
    )
    return result.scalar_one()


@router.post("/confirm", response_model=BookingOut)
async def confirm_booking(
    body: BookingConfirm,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(BookingRequest)
        .options(
            selectinload(BookingRequest.booker),
            selectinload(BookingRequest.invites),
        )
        .where(BookingRequest.id == body.request_id)
    )
    req = result.scalar_one_or_none()
    if not req or req.status != RequestStatus.pending:
        raise HTTPException(status_code=404, detail="Request not found or no longer pending")

    if req.booker_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot confirm your own request")

    if req.type == RequestType.named:
        invite = next(
            (i for i in req.invites if i.invited_player_id == current_user.id), None
        )
        if not invite:
            raise HTTPException(status_code=403, detail="You are not invited to this request")

    partner_locked = await db.execute(
        select(Booking).where(
            and_(
                or_(Booking.booker_id == current_user.id, Booking.partner_id == current_user.id),
                Booking.status == BookingStatus.confirmed,
                Booking.slot_end > now,
            )
        )
    )
    if partner_locked.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a confirmed upcoming booking")

    tz_sp = ZoneInfo("America/Sao_Paulo")
    now_sp = datetime.now(tz_sp).replace(tzinfo=None)
    if current_user.locked_until and now_sp < current_user.locked_until:
        until = current_user.locked_until.strftime("%d/%m as %H:%M")
        raise HTTPException(status_code=400, detail=f"Voce cancelou uma reserva de ultima hora. Novas reservas liberadas apos {until}")

    available = await _available_courts(db, req.slot_start, req.slot_end)
    if not any(c.id == body.court_id for c in available):
        raise HTTPException(status_code=409, detail="That court is no longer available")

    req.status = RequestStatus.confirmed
    if req.type == RequestType.named:
        invite.status = InviteStatus.accepted

    booking = Booking(
        request_id=req.id,
        court_id=body.court_id,
        booker_id=req.booker_id,
        partner_id=current_user.id,
        slot_start=req.slot_start,
        slot_end=req.slot_end,
        status=BookingStatus.confirmed,
    )
    db.add(booking)

    await _cancel_other_pending(db, req.booker_id, req.id)
    await _cancel_other_pending(db, current_user.id, -1)

    await db.commit()
    await db.refresh(booking)

    still_available = await _available_courts(db, req.slot_start, req.slot_end)
    if len(still_available) == 0:
        leftover = await db.execute(
            select(BookingRequest).where(
                and_(
                    BookingRequest.slot_start == req.slot_start,
                    BookingRequest.status == RequestStatus.pending,
                )
            )
        )
        for leftover_req in leftover.scalars().all():
            leftover_req.status = RequestStatus.cancelled
        await db.commit()

    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.court),
            selectinload(Booking.booker),
            selectinload(Booking.partner),
        )
        .where(Booking.id == booking.id)
    )
    booking = result.scalar_one()

    slot_start_str = booking.slot_start.strftime("%d/%m/%Y %H:%M")
    slot_end_str = booking.slot_end.strftime("%H:%M")
    await email_service.send_booking_confirmed(
        booking.booker.email, booking.booker.name,
        booking.partner.email, booking.partner.name,
        booking.court.name, slot_start_str, slot_end_str,
    )

    return booking


@router.get("/mine", response_model=list[BookingOut])
async def my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.court),
            selectinload(Booking.booker),
            selectinload(Booking.partner),
        )
        .where(
            and_(
                or_(Booking.booker_id == current_user.id, Booking.partner_id == current_user.id),
                Booking.status == BookingStatus.confirmed,
            )
        )
        .order_by(Booking.slot_start)
    )
    return result.scalars().all()


@router.get("/mine/cancelled", response_model=list[BookingOut])
async def my_cancelled_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz = ZoneInfo("America/Sao_Paulo")
    now_sp = datetime.now(tz).replace(tzinfo=None)
    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.court),
            selectinload(Booking.booker),
            selectinload(Booking.partner),
        )
        .where(
            and_(
                or_(Booking.booker_id == current_user.id, Booking.partner_id == current_user.id),
                Booking.status == BookingStatus.cancelled,
                Booking.is_late_cancel == True,
                Booking.slot_end > now_sp,
            )
        )
        .order_by(Booking.slot_start)
    )
    return result.scalars().all()


@router.get("/requests/mine", response_model=list[BookingRequestOut])
async def my_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BookingRequest)
        .options(
            selectinload(BookingRequest.booker),
            selectinload(BookingRequest.invites).selectinload(BookingRequestInvite.invited_player),
        )
        .where(
            and_(
                BookingRequest.booker_id == current_user.id,
                BookingRequest.status == RequestStatus.pending,
            )
        )
        .order_by(BookingRequest.slot_start)
    )
    return result.scalars().all()


@router.delete("/requests/{request_id}", status_code=204)
async def cancel_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BookingRequest).where(BookingRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.booker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")
    if req.status != RequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request is not pending")
    req.status = RequestStatus.cancelled
    await db.commit()


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.request))
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.booker_id != current_user.id and booking.partner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=400, detail="Booking is not active")

    tz = ZoneInfo("America/Sao_Paulo")
    now_sp = datetime.now(tz).replace(tzinfo=None)
    midnight_before = booking.slot_start.replace(hour=0, minute=0, second=0, microsecond=0)
    is_late = now_sp >= midnight_before

    booking.status = BookingStatus.cancelled
    booking.request.status = RequestStatus.cancelled

    if is_late:
        booking.is_late_cancel = True
        for uid in [booking.booker_id, booking.partner_id]:
            r = await db.execute(select(User).where(User.id == uid))
            u = r.scalar_one()
            if u.locked_until is None or booking.slot_end > u.locked_until:
                u.locked_until = booking.slot_end

    await db.commit()
