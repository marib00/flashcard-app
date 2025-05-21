from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import List, Optional
from datetime import datetime

class Answer(BaseModel):
    id: str
    text: str
    is_correct: bool

class CardBase(BaseModel):
    question: str
    answers: List[Answer]
    explanation: str

class CardCreate(CardBase):
    pass

class Card(CardBase):
    id: int
    stability: Optional[float] = None
    difficulty: Optional[float] = None
    next_review: Optional[datetime] = None
    review_count: Optional[int] = None
    is_suspended: Optional[bool] = False
    rating_history: Optional[List[int]] = []
    
    model_config = ConfigDict(from_attributes=True)

class UserProgressBase(BaseModel):
    card_id: int
    rating: int = Field(..., ge=1, le=4)

class UserProgressCreate(UserProgressBase):
    pass

class UserProgress(BaseModel):
    id: int
    card_id: int
    user_id: int
    stability: float
    difficulty: float
    last_review: Optional[datetime] = None
    next_review: Optional[datetime] = None
    review_count: int
    rating: Optional[int] = None
    is_suspended: bool
    rating_history: List[int] = []
    
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: Optional[str] = None

class User(UserBase):
    id: int
    created_at: datetime
    google_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[EmailStr] = None

class ReviewedCardSummary(BaseModel):
    card_id: int
    question: str
    stability: Optional[float] = None
    difficulty: Optional[float] = None
    review_count: Optional[int] = None
    next_review: Optional[datetime] = None
    last_review: Optional[datetime] = None
    is_suspended: bool
    rating_history: List[int] = []

    model_config = ConfigDict(from_attributes=True) 