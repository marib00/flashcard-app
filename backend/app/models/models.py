from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func # Import func for server_default
from datetime import datetime
from ..db.database import Base

# Updated User Model (using email as identifier)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # username = Column(String, unique=True, index=True, nullable=False) # Removed username
    email = Column(String, unique=True, index=True, nullable=False) # Email is now required and unique
    hashed_password = Column(String, nullable=True) # Allow null password for Google-only users
    google_id = Column(String, unique=True, index=True, nullable=True) # New field for Google ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to UserProgress (optional, for potential ORM access)
    progress = relationship("UserProgress", back_populates="user")

class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    # test_number = Column(Integer) # Removed
    # question_number = Column(Integer) # Removed
    question = Column(String)
    answers = Column(String)  # JSON string of answers
    explanation = Column(String)
    correct_answers = Column(String)  # JSON string of correct answer IDs

    # Relationship to UserProgress
    user_progress = relationship("UserProgress", back_populates="card")

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Added user_id foreign key
    
    rating = Column(Integer, nullable=True) # Rating from the last review
    last_review = Column(DateTime)
    next_review = Column(DateTime)
    stability = Column(Float, default=0.0)
    difficulty = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    rating_history = Column(JSON, default=list) # Store list of ratings
    is_suspended = Column(Boolean, default=False, nullable=False)

    # Relationships
    card = relationship("Card", back_populates="user_progress")
    user = relationship("User", back_populates="progress") # Added relationship to User

    # Add unique constraint for user_id and card_id
    from sqlalchemy import UniqueConstraint
    __table_args__ = (UniqueConstraint('user_id', 'card_id', name='_user_card_uc'),) 