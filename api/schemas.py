from datetime import datetime, time, date
from typing import Optional
import json
from pydantic import BaseModel, EmailStr, field_validator
from api.models import BookingStatus, InviteStatus, RequestStatus, RequestType, UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.player


class UserUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


class PlayerBasicOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


TENNIS_CATEGORIES = ["iniciante", "5a_classe", "4a_classe", "3a_classe", "2a_classe", "1a_classe"]


class UserProfileOut(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    is_active: bool
    dob: Optional[str] = None
    gender: Optional[str] = None
    tennis_category: Optional[str] = None
    favorite_times: list[str] = []

    model_config = {"from_attributes": True}

    @field_validator("favorite_times", mode="before")
    @classmethod
    def parse_favorite_times(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v or []


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    tennis_category: Optional[str] = None
    favorite_times: Optional[list[str]] = None


class CourtOut(BaseModel):
    id: int
    name: str
    is_active: bool
    is_singles_only: bool = False

    model_config = {"from_attributes": True}


class CourtUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduleBlockCreate(BaseModel):
    title: str
    court_id: Optional[int] = None
    time_start: time
    time_end: time
    recurrence: str = "none"
    weekdays: list[int] = []
    specific_date: Optional[date] = None
    is_release: bool = False


class ScheduleBlockOut(BaseModel):
    id: int
    title: str
    court_id: Optional[int]
    time_start: time
    time_end: time
    recurrence: str
    weekdays: list[int] = []
    specific_date: Optional[date]
    is_release: bool

    model_config = {"from_attributes": True}

    @field_validator("weekdays", mode="before")
    @classmethod
    def parse_weekdays(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v or []


class ClubSettingsOut(BaseModel):
    booking_window_days: int
    timezone: str


class ClubSettingsUpdate(BaseModel):
    booking_window_days: Optional[int] = None
    timezone: Optional[str] = None


class BookingRequestCreate(BaseModel):
    slot_start: datetime
    type: RequestType
    invited_player_ids: list[int] = []


class InviteOut(BaseModel):
    id: int
    invited_player: UserOut
    status: InviteStatus

    model_config = {"from_attributes": True}


class BookingRequestOut(BaseModel):
    id: int
    booker: UserOut
    slot_start: datetime
    slot_end: datetime
    type: RequestType
    status: RequestStatus
    invites: list[InviteOut] = []

    model_config = {"from_attributes": True}


class BookingConfirm(BaseModel):
    request_id: int
    court_id: int


class BookingOut(BaseModel):
    id: int
    request_id: int
    court: CourtOut
    booker: UserOut
    partner: UserOut
    slot_start: datetime
    slot_end: datetime
    status: BookingStatus
    is_late_cancel: bool = False

    model_config = {"from_attributes": True}


class SlotAvailability(BaseModel):
    slot_start: datetime
    slot_end: datetime
    available_courts: list[CourtOut]
    open_requests: list[BookingRequestOut]
    invited_requests: list[BookingRequestOut]
    my_named_requests: list[BookingRequestOut] = []
    my_booking: Optional["BookingOut"] = None
    total_courts: int


class PlayerStat(BaseModel):
    player: UserOut
    bookings_this_week: int
    total_bookings: int
    cancellation_rate: float


class StatsOut(BaseModel):
    player_stats: list[PlayerStat]
    utilization_rate: float
    open_request_ratio: float
    peak_hours: dict[str, int]
