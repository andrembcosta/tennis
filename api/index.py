from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import auth, users, courts, bookings, admin

app = FastAPI(title="Tennis Club Booking", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courts.router)
app.include_router(bookings.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
