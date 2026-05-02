import enum
from datetime import datetime, time, date
from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer,
    String, Time, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base


class UserRole(str, enum.Enum):
    player = "player"
    admin = "admin"


class RequestType(str, enum.Enum):
    open = "open"
    named = "named"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"


class InviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class BookingStatus(str, enum.Enum):
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.player)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    external_id: Mapped[str | None] = mapped_column(String, nullable=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    dob: Mapped[str | None] = mapped_column(String, nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    tennis_category: Mapped[str | None] = mapped_column(String, nullable=True)
    favorite_times: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    booking_requests: Mapped[list["BookingRequest"]] = relationship(
        "BookingRequest", back_populates="booker", foreign_keys="BookingRequest.booker_id"
    )
    invites: Mapped[list["BookingRequestInvite"]] = relationship(
        "BookingRequestInvite", back_populates="invited_player"
    )
    bookings_as_booker: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="booker", foreign_keys="Booking.booker_id"
    )
    bookings_as_partner: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="partner", foreign_keys="Booking.partner_id"
    )


class Court(Base):
    __tablename__ = "courts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_singles_only: Mapped[bool] = mapped_column(Boolean, default=False)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="court")


class ScheduleBlock(Base):
    __tablename__ = "schedule_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    court_id: Mapped[int | None] = mapped_column(ForeignKey("courts.id"), nullable=True)
    time_start: Mapped[time] = mapped_column(Time, nullable=False)
    time_end: Mapped[time] = mapped_column(Time, nullable=False)
    recurrence: Mapped[str] = mapped_column(String, default="none")  # "none"|"daily"|"weekly"
    weekdays: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON [0-6]
    specific_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_release: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClubSettings(Base):
    __tablename__ = "club_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_window_days: Mapped[int] = mapped_column(Integer, default=7)
    timezone: Mapped[str] = mapped_column(String, default="America/Sao_Paulo")


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    slot_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    type: Mapped[RequestType] = mapped_column(Enum(RequestType), nullable=False)
    status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus), default=RequestStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    booker: Mapped["User"] = relationship(
        "User", back_populates="booking_requests", foreign_keys=[booker_id]
    )
    invites: Mapped[list["BookingRequestInvite"]] = relationship(
        "BookingRequestInvite", back_populates="request", cascade="all, delete-orphan"
    )
    booking: Mapped["Booking | None"] = relationship(
        "Booking", back_populates="request", uselist=False
    )


class BookingRequestInvite(Base):
    __tablename__ = "booking_request_invites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("booking_requests.id"), nullable=False)
    invited_player_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus), default=InviteStatus.pending)

    request: Mapped["BookingRequest"] = relationship("BookingRequest", back_populates="invites")
    invited_player: Mapped["User"] = relationship("User", back_populates="invites")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("booking_requests.id"), nullable=False)
    court_id: Mapped[int] = mapped_column(ForeignKey("courts.id"), nullable=False)
    booker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    partner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    slot_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.confirmed)
    is_late_cancel: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    request: Mapped["BookingRequest"] = relationship("BookingRequest", back_populates="booking")
    court: Mapped["Court"] = relationship("Court", back_populates="bookings")
    booker: Mapped["User"] = relationship(
        "User", back_populates="bookings_as_booker", foreign_keys=[booker_id]
    )
    partner: Mapped["User"] = relationship(
        "User", back_populates="bookings_as_partner", foreign_keys=[partner_id]
    )
