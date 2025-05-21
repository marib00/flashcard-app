from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt # Python-jose library instead of PyJWT
from decouple import config # For handling environment variables

# Load secrets from .env file or environment variables
SECRET_KEY = config("SECRET_KEY", default="a_very_secret_key_that_should_be_in_env") # Replace with a strong random key
ALGORITHM = config("ALGORITHM", default="HS256")
# Set expiration to 30 days (in minutes)
ACCESS_TOKEN_EXPIRE_MINUTES = config("ACCESS_TOKEN_EXPIRE_MINUTES", default=43200, cast=int) # 30 days * 24 hours * 60 minutes

# Password Hashing Context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)

# JWT Token Creation (Updated to use email as subject)
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token using email as the subject."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Ensure the subject ('sub') uses the email
    if "sub" not in to_encode:
        raise ValueError("Subject ('sub') key missing in token data")
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Note: Token verification logic will be part of the FastAPI dependency 