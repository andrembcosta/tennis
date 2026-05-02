"""Run once to create tables and seed initial data: 3 courts, 1 admin, 6 players, default schedule blocks."""
import asyncio
import json
from datetime import time
from api.database import engine, AsyncSessionLocal, Base
from api.models import Court, ClubSettings, ScheduleBlock, User
from api.auth import hash_password


# name, email, dob, gender, category, favorite_times
PLAYERS = [
    ("John Smith",   "john@tennisclub.com",  "1985-03-15", "masculino", "1a_classe", ["segunda|08:00", "quarta|08:00", "sabado|09:00"]),
    ("Carl Davies",  "carl@tennisclub.com",  "1990-07-22", "masculino", "2a_classe", ["terca|18:00",  "quinta|18:00",  "sabado|10:00"]),
    ("Maria Garcia", "maria@tennisclub.com", "1988-11-08", "feminino",  "1a_classe", ["segunda|07:00", "sexta|07:00"]),
    ("Steve Wilson", "steve@tennisclub.com", "1975-05-30", "masculino", "3a_classe", ["sabado|09:00", "domingo|10:00"]),
    ("Anna Novak",   "anna@tennisclub.com",  "1992-09-14", "feminino",  "2a_classe", ["segunda|18:00", "quarta|18:00",  "sexta|18:00"]),
    ("Mike Johnson", "mike@tennisclub.com",  "1998-02-26", "masculino", "4a_classe", ["sabado|08:00", "domingo|09:00"]),
]

# Default schedule blocks to approximate current club hours:
# Weekdays 08:00-22:00, Weekends 09:00-20:00
DEFAULT_BLOCKS = [
    # Early morning closed (all days)
    {"title": "Clube Fechado", "time_start": time(0, 0), "time_end": time(8, 0),
     "recurrence": "daily", "weekdays": None, "specific_date": None, "is_release": False, "court_id": None},
    # Late night closed (all days)
    {"title": "Clube Fechado", "time_start": time(22, 0), "time_end": time(0, 0),
     "recurrence": "daily", "weekdays": None, "specific_date": None, "is_release": False, "court_id": None},
    # Weekend extra: closed 08:00-09:00
    {"title": "Clube Fechado (fim de semana)", "time_start": time(8, 0), "time_end": time(9, 0),
     "recurrence": "weekly", "weekdays": json.dumps([5, 6]), "specific_date": None, "is_release": False, "court_id": None},
    # Weekend extra: closes at 20:00
    {"title": "Clube Fechado (fim de semana)", "time_start": time(20, 0), "time_end": time(22, 0),
     "recurrence": "weekly", "weekdays": json.dumps([5, 6]), "specific_date": None, "is_release": False, "court_id": None},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for i, (name, singles) in enumerate([("Quadra 1", False), ("Quadra 2", False), ("Quadra 3", True)], 1):
            db.add(Court(id=i, name=name, is_active=True, is_singles_only=singles))

        db.add(ClubSettings())

        for blk in DEFAULT_BLOCKS:
            db.add(ScheduleBlock(**blk))

        db.add(User(
            email="admin@tennisclub.com",
            name="Club Admin",
            hashed_password=hash_password("changeme"),
            role="admin",
        ))

        for name, email, dob, gender, category, times in PLAYERS:
            db.add(User(
                email=email,
                name=name,
                hashed_password=hash_password("changeme"),
                role="player",
                dob=dob,
                gender=gender,
                tennis_category=category,
                favorite_times=json.dumps(times),
            ))

        await db.commit()
        print("Seeded successfully!")
        print()
        print("Admin:")
        print("  admin@tennisclub.com / changeme")
        print()
        print("Players (all use password: changeme):")
        for name, email, *_ in PLAYERS:
            print(f"  {email} - {name}")


if __name__ == "__main__":
    asyncio.run(seed())
