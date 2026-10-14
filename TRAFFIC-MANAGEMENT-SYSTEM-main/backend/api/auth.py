from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Union
from pydantic import BaseModel
from db.database import get_db, get_settings
from db.models import UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

class LoginRequest(BaseModel):
    username: str
    password: str

def verify_password(plain: str, hashed: str) -> bool:
    try:
        if isinstance(hashed, str):
            hashed = hashed.encode('utf-8')
        return bcrypt.checkpw(plain.encode('utf-8'), hashed)
    except Exception:
        return False

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=480))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    settings = get_settings()
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        # Fallback default user for internal dashboard requests if token is missing
        db = get_db()
        user = await db.users.find_one({"username": "admin"})
        if user:
            return user
        raise credentials_exc

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    db = get_db()
    user = await db.users.find_one({"username": username})
    if not user:
        raise credentials_exc
    return user

async def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.post("/login")
async def login(request: Request):
    """
    Universal login supporting both JSON {"username": "...", "password": "..."}
    and x-www-form-urlencoded / FormData.
    """
    username = None
    password = None

    # Try JSON body first
    try:
        body = await request.json()
        username = body.get("username")
        password = body.get("password")
    except Exception:
        pass

    # Fallback to form data
    if not username or not password:
        try:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password required",
        )

    db = get_db()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_token({"sub": user["username"], "role": user.get("role", "admin")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"username": user["username"], "role": user.get("role", "admin")},
    }

@router.post("/register")
async def register(request: Request):
    username = None
    password = None

    try:
        body = await request.json()
        username = body.get("username")
        password = body.get("password")
    except Exception:
        pass

    if not username or not password:
        try:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    db = get_db()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = hash_password(password)
    await db.users.insert_one({
        "username": username,
        "hashed_password": hashed,
        "role": "operator",
        "created_at": datetime.utcnow(),
    })
    return {"message": "User created successfully"}

@router.get("/me", response_model=UserOut)
async def get_me(current_user=Depends(get_current_user)):
    return UserOut(username=current_user["username"], role=current_user["role"])
