# backend/main.py
import os
import shutil
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from passlib.context import CryptContext
from jose import JWTError, jwt
from starlette.responses import Response
from starlette.status import HTTP_401_UNAUTHORIZED


# ---------- Config ----------
BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "database.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# SECRET_KEY: set as environment variable for production. For local dev, default is provided.
SECRET_KEY = os.environ.get("SECRET_KEY", "change_this_secret_for_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# ---------- DB integrity check (if corrupted, rename and start fresh) ----------
def check_and_rename_corrupt(db_path: str):
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("PRAGMA integrity_check;")
        r = cur.fetchone()
        conn.close()
        if r and r[0].lower() == "ok":
            return
    except sqlite3.DatabaseError:
        pass
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    corrupt = os.path.join(BASE_DIR, f"database_corrupt_{ts}.db")
    shutil.move(db_path, corrupt)
    print(f"[DB] Renamed corrupted DB -> {corrupt}")

check_and_rename_corrupt(DB_PATH)

# ---------- SQLAlchemy setup ----------
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# ---------- Models ----------
class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    transactions = relationship("TransactionDB", back_populates="owner", cascade="all, delete-orphan")

# Define IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))


class TransactionDB(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # "income" or "expense"
    category = Column(String, nullable=True)
    IST = timezone(timedelta(hours=5, minutes=30))  # UTC+5:30
    date = Column(DateTime(timezone=True), default=lambda: datetime.now(IST))

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("UserDB", back_populates="transactions")

Base.metadata.create_all(bind=engine)

# ---------- App ----------
app = FastAPI(title="Finance Tracker (Auth)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Security utils ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ---------- Pydantic schemas ----------
class UserCreate(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class TransactionCreate(BaseModel):
    title: str
    amount: float
    type: str
    category: Optional[str] = None
    date: Optional[datetime] = None

class TransactionResponse(BaseModel):
    id: int
    title: str
    amount: float
    type: str
    category: Optional[str] = None
    date: datetime

    class Config:
        orm_mode = True

class SummaryResponse(BaseModel):
    total_income: float
    total_expense: float
    net_balance: float

# ---------- DB dependency ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- Auth dependency ----------
def get_current_user(token: str = Depends(lambda: None), db: Session = Depends(get_db)):
    # We cannot use lambda here in real app; but we call this by passing token manually below.
    raise HTTPException(status_code=400, detail="Internal usage only")

# We'll define a proper helper below to reuse in endpoints.

def get_current_user_from_token(token: str, db: Session):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# ---------- Routes ----------
@app.post("/register", status_code=201)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(UserDB).filter(UserDB.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = get_password_hash(user.password)
    db_user = UserDB(username=user.username, hashed_password=hashed)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "username": db_user.username}

@app.post("/login", response_model=TokenResponse)
def login(payload: UserCreate, db: Session = Depends(get_db)):
    # Accepts JSON {username, password}
    user = db.query(UserDB).filter(UserDB.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

# Protected helper used inside endpoints
def require_user_from_header(authorization_header: Optional[str], db: Session):
    if not authorization_header:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = parts[1]
    return get_current_user_from_token(token, db)

@app.post("/add-transaction", response_model=TransactionResponse)
def add_transaction(tx: TransactionCreate, authorization: Optional[str] = None, db: Session = Depends(get_db)):
    # FastAPI will pass Authorization header if you declare it in parameter, but we will fetch manually via request
    # Simple: get authorization header from os.environ? We'll get it via special header injection in client fetch call.
    # To keep things simple, read from a special param (we expect header via 'authorization' set by FastAPI dependency injection).
    from fastapi import Header
    # get header
    # (the function signature won't allow Header here, so use request-based approach below instead)
    raise HTTPException(status_code=500, detail="Use endpoint wrapped with get_current_user route")

# We'll instead create endpoints that explicitly take the Authorization header via Header(...)

from fastapi import Header, Request

@app.post("/tx/add", response_model=TransactionResponse)
def add_transaction_protected(tx: TransactionCreate, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = require_user_from_header(authorization, db)

    # Always use IST if no date is provided
    tx_date = tx.date if tx.date else datetime.now(IST)

    # If user gave date without tz, convert it to IST
    if tx.date and not tx.date.tzinfo:
        tx_date = tx.date.replace(tzinfo=IST)

    db_tx = TransactionDB(
        title=tx.title,
        amount=tx.amount,
        type=tx.type,
        category=tx.category,
        date=tx_date,
        owner_id=user.id
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx

@app.get("/transactions", response_model=List[TransactionResponse])
def get_transactions_protected(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = require_user_from_header(authorization, db)
    rows = db.query(TransactionDB).filter(TransactionDB.owner_id == user.id).order_by(TransactionDB.date.desc()).all()
    return rows

@app.delete("/delete-transaction/{tx_id}")
def delete_transaction_protected(tx_id: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = require_user_from_header(authorization, db)
    tx = db.query(TransactionDB).filter(TransactionDB.id == tx_id, TransactionDB.owner_id == user.id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"status": "success", "message": f"Transaction {tx_id} deleted"}

@app.get("/summary", response_model=SummaryResponse)
def summary_protected(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = require_user_from_header(authorization, db)
    transactions = db.query(TransactionDB).filter(TransactionDB.owner_id == user.id).all()
    total_income = round(sum(t.amount for t in transactions if t.type == "income"), 2)
    total_expense = round(sum(t.amount for t in transactions if t.type == "expense"), 2)
    return SummaryResponse(total_income=total_income, total_expense=total_expense, net_balance=round(total_income - total_expense, 2))

# Export CSV for current user
def iter_csv(rows):
    import csv
    from io import StringIO
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "title", "amount", "type", "category", "date"])
    yield buffer.getvalue()
    buffer.seek(0); buffer.truncate(0)
    for r in rows:
        writer.writerow([r.id, r.title, r.amount, r.type, r.category or "", r.date.isoformat()])
        yield buffer.getvalue()
        buffer.seek(0); buffer.truncate(0)

@app.get("/export-csv")
def export_csv_protected(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = require_user_from_header(authorization, db)
    rows = db.query(TransactionDB).filter(TransactionDB.owner_id == user.id).order_by(TransactionDB.date.desc()).all()
    return StreamingResponse(iter_csv(rows), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=transactions.csv"})


from fastapi.staticfiles import StaticFiles
import os

# Move up one level from backend/ and then into frontend/
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")

app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

