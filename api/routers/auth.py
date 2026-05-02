import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.database import get_db
from api.models import User
from api.auth import (
    verify_password, hash_password, create_access_token,
    create_reset_token, decode_reset_token, get_current_user,
)
from api.schemas import (
    LoginRequest, TokenResponse, PasswordResetRequest,
    PasswordResetConfirm, UserOut, UserProfileOut, ProfileUpdate,
)
from api import email as email_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserProfileOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserProfileOut)
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.name is not None:
        current_user.name = body.name
    if body.dob is not None:
        current_user.dob = body.dob
    if body.gender is not None:
        current_user.gender = body.gender
    if body.tennis_category is not None:
        current_user.tennis_category = body.tennis_category
    if body.favorite_times is not None:
        current_user.favorite_times = json.dumps(body.favorite_times[:3])
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/forgot-password")
async def forgot_password(body: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        token = create_reset_token(user.id)
        await email_service.send_password_reset(user.email, user.name, token)
    # always return 200 to avoid email enumeration
    return {"message": "If that email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    user_id = decode_reset_token(body.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated"}
