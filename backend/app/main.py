from fastapi import FastAPI, Depends, HTTPException, status, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from starlette.middleware.sessions import SessionMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, cast, JSON
from typing import List, Optional, Dict, Any
import json
import logging # Import logging
import sys
from datetime import datetime, timedelta
from jose import JWTError, jwt
from . import models
from . import crud  # Add the crud module import
from .db.database import engine, get_db, Base
from .core.fsrs import FSRS
from .schemas import Card, UserProgress, UserProgressCreate, Answer, TokenData, Token, User, UserCreate, ReviewedCardSummary
from .core import security
from enum import Enum
from collections import defaultdict
import os # Added
from dotenv import load_dotenv # Added
from authlib.integrations.starlette_client import OAuth, OAuthError # Added
from starlette.responses import RedirectResponse # Added

# Load environment variables from .env file
load_dotenv()

# Configure more detailed logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for maximum detail
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # Log to stdout as well
        logging.FileHandler("detailed_debug.log")  # Additional detailed log file
    ]
)
logger = logging.getLogger(__name__)

# Log import stage completion
logger.info("=== IMPORTS SUCCESSFUL ===")

try:
    # Create all tables if they don't exist
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
    
    # Test database connection
    with engine.connect() as conn:
        logger.info("Testing database connection...")
        result = conn.execute(text("SELECT 1"))
        logger.info(f"Database connection test result: {result.fetchone()}")
        
        # Check if cards table exists and has data
        try:
            result = conn.execute(text("SELECT COUNT(*) FROM cards"))
            count = result.scalar()
            logger.info(f"Cards table exists with {count} records")
        except Exception as e:
            logger.error(f"Error checking cards table: {e}")
            
except Exception as e:
    logger.error(f"Database initialization error: {e}", exc_info=True)
    raise

logger.info("=== DATABASE INITIALIZATION COMPLETE ===")

app = FastAPI()

# --- Add Session Middleware (Needs a secret key!) --- # Added Block
# Make sure SESSION_SECRET_KEY is set in your .env file
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY")
if not SESSION_SECRET_KEY:
    print("WARNING: SESSION_SECRET_KEY environment variable not set. Session middleware will not function securely.")
    # Optionally raise an error or use a default for local dev (NOT recommended for production)
    # raise ValueError("Missing SESSION_SECRET_KEY in environment variables")
    SESSION_SECRET_KEY = "a_default_weak_secret_for_dev_only" # Use a default only if absolutely necessary for local dev

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    # Configure cookie parameters as needed (e.g., https_only=True for production)
    # https_only=False, # Set to True if served over HTTPS
    # max_age=14 * 24 * 60 * 60  # Example: 14 days
)
# --- End Added Block ---

# --- CORS Middleware ---
# Add CORS middleware AFTER SessionMiddleware if sessions are needed cross-origin
origins = [
    "http://localhost:3000", # React default dev port
    "http://localhost",
    "http://127.0.0.1:3000",
    "http://127.0.0.1"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate Limiter Configuration ---
limiter = Limiter(key_func=get_remote_address) # Use IP address for rate limiting key

# Apply default rate limit to all routes (adjust as needed)
# Example: "100/minute"
DEFAULT_RATE_LIMIT = "100/minute"

fsrs = FSRS() # Initialize the FSRS instance

# --- OAuth2 Scheme Definition ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# --- Dependency to get current user from token (Updated for email) ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: Optional[str] = payload.get("sub") # Subject should be email
        if email is None:
            logger.warning("Token validation failed: Email (sub) missing in payload")
            raise credentials_exception
        token_data = TokenData(email=email) # Use email
    except JWTError as e:
        logger.error(f"Token validation error: {e}", exc_info=True)
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == token_data.email).first() # Find user by email
    if user is None:
        logger.warning(f"Token validation failed: User with email '{token_data.email}' not found in DB")
        raise credentials_exception
    logger.info(f"Token validated successfully for user: {user.email}")
    return user

logger.info("=== FASTAPI APP CREATED ===")

@app.on_event("startup")
async def startup_event():
    logger.info("=== APPLICATION STARTING UP ===")
    # Log app configuration
    logger.info(f"FastAPI app routes: {[route.path for route in app.routes]}")

# --- Add Rate Limiter State and Exception Handler ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Add Basic User-Agent Check Middleware ---
@app.middleware("http")
async def check_user_agent(request: Request, call_next):
    user_agent = request.headers.get("User-Agent")
    # Basic check: block if User-Agent is missing or clearly a common bot signature
    # You can expand the list of blocked agents
    blocked_agents = ["bot", "crawl", "spider"]
    
    if not user_agent or any(agent in user_agent.lower() for agent in blocked_agents):
        logger.warning(f"Blocked request due to suspicious User-Agent: {user_agent} from IP: {request.client.host}")
        # Return a generic error, don't reveal too much
        return Response(content="Forbidden", status_code=status.HTTP_403_FORBIDDEN)
        
    response = await call_next(request)
    return response

# Add a simple root endpoint to check if server is running
@app.get("/")
@limiter.limit("100/minute")
def read_root(request: Request):
    return {"status": "API is running"}

@app.get("/cards/count/")
@limiter.limit("100/minute")
def get_card_count(request: Request, db: Session = Depends(get_db)):
    """Get the total number of cards in the database using SQLAlchemy."""
    try:
        # Use SQLAlchemy's functions instead of raw SQL
        result = db.query(func.count(models.Card.id)).scalar()
        logger.info(f"Total cards count: {result}")
        return {"count": result}
    except Exception as e:
        logger.error(f"Error counting cards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error counting cards in database")

@app.delete("/users/me/progress/")
@limiter.limit("10/minute")
def delete_my_user_progress(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Deletes all progress records for the currently authenticated user."""
    logger.warning(f"Received request to DELETE progress data for user: {current_user.email}")
    try:
        # Filter deletion by the current user's ID
        num_deleted = db.query(models.UserProgress).filter(
            models.UserProgress.user_id == current_user.id
        ).delete()
        db.commit()
        logger.info(f"Successfully deleted {num_deleted} progress records for user {current_user.email}.")
        return {"message": f"Successfully deleted {num_deleted} progress records for user {current_user.email}."}
    except Exception as e:
        logger.error(f"Error deleting user progress for {current_user.email}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete user progress data")

@app.get("/users/me/progress/", response_model=List[UserProgress])
@limiter.limit("100/minute")
def get_my_progress_history(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Retrieves all UserProgress records for the currently authenticated user."""
    logger.info(f"Fetching all progress records for user: {current_user.email}")
    try:
        progress_records = db.query(models.UserProgress).filter(
            models.UserProgress.user_id == current_user.id
        ).all()
        logger.info(f"Found {len(progress_records)} progress records for user {current_user.email}.")
        return progress_records
    except Exception as e:
        logger.error(f"Error fetching progress history for {current_user.email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch progress history")

# Updated Helper function to convert DB Card to API Card model including UserProgress
def db_card_to_api_card(db_card: models.Card, db_progress: Optional[models.UserProgress] = None) -> dict:
    logger.debug(f"Converting card ID: {db_card.id} - Progress: {'Yes' if db_progress else 'No'}")
    try:
        answers = json.loads(db_card.answers)
        logger.debug(f"Successfully parsed answers for card ID: {db_card.id}")
    except json.JSONDecodeError as e:
        logger.error(f"JSONDecodeError for card ID {db_card.id}: {e} - Answers: {db_card.answers}")
        answers = []
    except Exception as e:
        logger.error(f"Unexpected error parsing answers for card ID {db_card.id}: {e}")
        answers = []
        
    card_data = {
        "id": db_card.id,
        "question": db_card.question,
        "answers": answers,
        "explanation": db_card.explanation,
        # Initialize SRS fields as None or default
        "stability": None,
        "difficulty": None,
        "next_review": None,
        "review_count": 0,
        "is_suspended": False, # Default suspended status
        "rating_history": [] # Initialize history field
    }
    
    # Merge progress data if available
    if db_progress:
        card_data["stability"] = db_progress.stability
        card_data["difficulty"] = db_progress.difficulty
        card_data["next_review"] = db_progress.next_review
        card_data["review_count"] = db_progress.review_count
        card_data["is_suspended"] = db_progress.is_suspended # Get suspended status
        card_data["rating_history"] = db_progress.rating_history if isinstance(db_progress.rating_history, list) else [] # Add history, ensure it's a list
        logger.debug(f"Merged progress data for card {db_card.id}: S={db_progress.stability:.2f}, D={db_progress.difficulty:.2f}, Count={db_progress.review_count}, Suspended={card_data['is_suspended']}, History={card_data['rating_history']}")

    return card_data

@app.get("/cards/due/", response_model=List[Card])
@limiter.limit("100/minute")
def get_due_cards(request: Request, limit: int = 5, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    logger.info(f"GET /cards/due/ - User: {current_user.email} - Fetching up to {limit} due cards")
    try:
        now = datetime.utcnow()
        active_ratings = [1, 2, 3, 4]  # Assuming active_ratings is a list of rating values
        due_progress_records = db.query(models.UserProgress).\
            filter(models.UserProgress.user_id == current_user.id).\
            filter(models.UserProgress.next_review <= now).\
            filter(models.UserProgress.rating.in_(active_ratings)).\
            options(joinedload(models.UserProgress.card)).\
            all()

        logger.info(f"User: {current_user.email} - Found {len(due_progress_records)} due progress records.")

        if not due_progress_records:
            logger.info(f"User: {current_user.email} - No due cards found.")
            return []

        result = []
        for progress in due_progress_records:
            if progress.card:
                 result.append(db_card_to_api_card(progress.card, progress))
            else:
                 logger.warning(f"User: {current_user.email} - Progress record {progress.id} missing card data.")

        logger.info(f"User: {current_user.email} - Returning {len(result)} due cards.")
        return result
    except Exception as e:
        logger.error(f"User: {current_user.email} - Error in get_due_cards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error fetching due cards")

@app.get("/cards/new/", response_model=List[Card])
@limiter.limit("100/minute")
def get_new_cards(request: Request, limit: int = 1, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    logger.info(f"GET /cards/new/ - User: {current_user.email} - Fetching up to {limit} new cards")
    try:
        # Subquery to find card IDs already reviewed by the *current user*
        user_progress_subquery = db.query(models.UserProgress.card_id)\
            .filter(models.UserProgress.user_id == current_user.id)\
            .subquery()

        # Find cards whose IDs are NOT in the subquery for this user
        # We only need to check if *any* progress exists, as we only care about truly new cards
        db_cards = db.query(models.Card)\
            .outerjoin(user_progress_subquery, models.Card.id == user_progress_subquery.c.card_id)\
            .filter(user_progress_subquery.c.card_id == None)\
            .order_by(func.random()) \
            .limit(limit)\
            .all()
        
        logger.info(f"User: {current_user.email} - Fetched {len(db_cards)} new cards.")

        if not db_cards:
            logger.info(f"User: {current_user.email} - No new cards found.")
            return []

        result = [db_card_to_api_card(card) for card in db_cards]
        logger.info(f"User: {current_user.email} - Returning {len(result)} new cards.")
        return result
    except Exception as e:
        logger.error(f"User: {current_user.email} - Error in get_new_cards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error fetching new cards")

@app.post("/cards/{card_id}/review/", response_model=dict)
@limiter.limit("100/minute")
def review_card(request: Request, card_id: int, review: UserProgressCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    logger.info(f"POST /cards/{card_id}/review/ - User: {current_user.email} - Rating: {review.rating}")
    try:
        card = db.query(models.Card).filter(models.Card.id == card_id).first()
        if not card:
            logger.warning(f"User: {current_user.email} - Card not found for review: ID {card_id}")
            raise HTTPException(status_code=404, detail="Card not found")

        # Find progress specific to this user and card
        progress = db.query(models.UserProgress)\
            .filter(models.UserProgress.card_id == card_id)\
            .filter(models.UserProgress.user_id == current_user.id)\
            .first()
            
        now = datetime.utcnow()
        current_rating = review.rating

        if not progress:
            logger.info(f"User: {current_user.email} - First review for card {card_id}")
            initial_stability = fsrs.w[0]
            initial_difficulty = fsrs.w[1]
            review_count = 0

            fsrs_result = fsrs.review(
                stability=initial_stability, 
                difficulty=initial_difficulty, 
                review_count=review_count,
                rating=current_rating
            )

            progress = models.UserProgress(
                card_id=card_id,
                user_id=current_user.id, # Associate with current user
                rating=current_rating,    # Save the rating
                stability=fsrs_result['stability'],
                difficulty=fsrs_result['difficulty'],
                review_count=1,
                last_review=now,
                next_review=fsrs_result['next_review'],
                is_suspended=False, # New cards are not suspended
                rating_history=[current_rating] # Initialize history
            )
            db.add(progress)
            logger.info(f"User: {current_user.email} - Created new progress: S={progress.stability:.2f}, D={progress.difficulty:.2f}, R={progress.rating}, History={progress.rating_history}")

        else:
            logger.info(f"User: {current_user.email} - Subsequent review card {card_id}. Current S={progress.stability:.2f}, D={progress.difficulty:.2f}, Count={progress.review_count}")
            fsrs_result = fsrs.review(
                stability=progress.stability, 
                difficulty=progress.difficulty, 
                review_count=progress.review_count,
                rating=current_rating
            )
            
            progress.stability = fsrs_result['stability']
            progress.difficulty = fsrs_result['difficulty']
            progress.next_review = fsrs_result['next_review']
            progress.rating = current_rating # Update the rating
            progress.review_count += 1
            progress.last_review = now
            progress.is_suspended = False # Reviewing a card unsuspends it
            
            # Append to rating history (ensure it's treated as a list)
            if not isinstance(progress.rating_history, list):
                logger.warning(f"User: {current_user.email} - Progress ID {progress.id} had non-list rating_history. Resetting.")
                progress.rating_history = []
            progress.rating_history = progress.rating_history + [current_rating]
            
            logger.info(f"User: {current_user.email} - Updated progress: S={progress.stability:.2f}, D={progress.difficulty:.2f}, R={progress.rating}, History={progress.rating_history}, Suspended={progress.is_suspended}")

        db.commit()
        db.refresh(progress)
        logger.info(f"User: {current_user.email} - Successfully reviewed/committed card ID: {card_id}")
        
        return {
            "message": "Review processed successfully using FSRS",
            "card_id": progress.card_id,
            "next_review": progress.next_review.isoformat() if progress.next_review else None,
            "review_count": progress.review_count,
            "stability": progress.stability,
            "difficulty": progress.difficulty,
            "is_suspended": progress.is_suspended,
            "rating_history": progress.rating_history # Include history in response
        }
    except Exception as e:
        logger.error(f"User: {current_user.email} - Error in review_card for ID {card_id}: {e}", exc_info=True)
        try:
            db.rollback()
            logger.info(f"User: {current_user.email} - DB rollback successful for card ID: {card_id}")
        except Exception as rb_e:
            logger.error(f"User: {current_user.email} - Error during rollback for card ID {card_id}: {rb_e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error processing review")

# --- New endpoint to Suspend/Unsuspend a card ---   
@app.post("/cards/{card_id}/suspend", response_model=dict)
@limiter.limit("50/minute")
def suspend_or_unsuspend_card(request: Request, card_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    logger.info(f"POST /cards/{card_id}/suspend - User: {current_user.email} - Toggling suspend status")
    try:
        # Find or create progress record for this user and card
        progress = db.query(models.UserProgress)\
            .filter(models.UserProgress.card_id == card_id)\
            .filter(models.UserProgress.user_id == current_user.id)\
            .first()
            
        if not progress:
            # If no progress exists, create one and mark it as suspended
            # Check if card exists first
            card_exists = db.query(models.Card.id).filter(models.Card.id == card_id).first()
            if not card_exists:
                 logger.warning(f"User: {current_user.email} - Card not found for suspension: ID {card_id}")
                 raise HTTPException(status_code=404, detail="Card not found")
                
            logger.info(f"User: {current_user.email} - Creating progress record for card {card_id} to suspend it.")
            progress = models.UserProgress(
                card_id=card_id,
                user_id=current_user.id,\
                is_suspended=True, # Suspend it immediately
                # Set sensible defaults even if not reviewed
                stability=0.0, \
                difficulty=0.0,\
                review_count=0,\
                last_review=None,\
                next_review=None, \
                rating_history=[]
            )
            db.add(progress)
            db.commit()
            db.refresh(progress)
            action = "suspended"
        else:
            # Toggle the existing suspended status
            current_status = progress.is_suspended
            progress.is_suspended = not current_status
            db.commit()
            db.refresh(progress)
            action = "unsuspended" if current_status else "suspended"
            logger.info(f"User: {current_user.email} - Card ID {card_id} {action}.")

        return {
            "message": f"Card {card_id} successfully {action}.",
            "card_id": card_id,
            "is_suspended": progress.is_suspended
        }
    except Exception as e:
        logger.error(f"User: {current_user.email} - Error toggling suspend status for card {card_id}: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception as rb_e:
            logger.error(f"User: {current_user.email} - Error during rollback for card {card_id} suspension: {rb_e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error toggling suspend status")

# --- Authentication Endpoints (Updated for email) ---
@app.post("/auth/register", response_model=User)
@limiter.limit("10/minute")
def register_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"Attempting to register user with email: {user.email}")
    db_user = db.query(models.User).filter(models.User.email == user.email).first() # Check by email
    if db_user:
        logger.warning(f"Registration failed: Email '{user.email}' already registered.")
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = security.get_password_hash(user.password)
    # Create user with email, no username
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    logger.info(f"User with email '{user.email}' registered successfully.")
    return db_user

@app.post("/auth/login", response_model=Token)
@limiter.limit("20/minute")
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Login uses username field from OAuth2PasswordRequestForm, which we'll treat as email
    email = form_data.username 
    logger.info(f"Login attempt for email: {email}")
    user = db.query(models.User).filter(models.User.email == email).first() # Find user by email
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Login failed for email: {email} - Invalid credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Use email as the subject for the token
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    logger.info(f"Login successful for email: {user.email}. Token generated.")
    return {"access_token": access_token, "token_type": "bearer"}

# --- Protected Endpoint Example (Get Current User - unchanged, already uses email indirectly via get_current_user) ---
@app.get("/users/me", response_model=User)
@limiter.limit("100/minute")
def read_users_me(request: Request, current_user: models.User = Depends(get_current_user)):
    """Returns the details of the currently authenticated user."""
    logger.info(f"Fetching details for currently logged-in user: {current_user.email}")
    return current_user

# --- Endpoint to get list of cards reviewed by the user --- 
@app.get("/users/me/reviewed-cards/", response_model=List[ReviewedCardSummary])
@limiter.limit("100/minute")
def get_my_reviewed_cards(
    request: Request, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Retrieves a summary of all cards reviewed by the currently authenticated user, along with their current stats."""
    logger.info(f"Fetching reviewed card summaries for user: {current_user.email}")
    try:
        # Query UserProgress joined with Card for the current user
        results = db.query(
            models.Card.id.label("card_id"),
            models.Card.question,
            models.UserProgress.stability,
            models.UserProgress.difficulty,
            models.UserProgress.review_count,
            models.UserProgress.next_review,
            models.UserProgress.last_review,
            models.UserProgress.is_suspended, # <<< Include suspended status
            models.UserProgress.rating_history # Add rating_history to the query
        ).join(models.UserProgress, models.Card.id == models.UserProgress.card_id)\
         .filter(models.UserProgress.user_id == current_user.id)\
         .order_by(models.UserProgress.last_review.desc().nullslast())\
         .all()
        
        logger.info(f"Found {len(results)} reviewed card records for user {current_user.email}.")
        
        # Convert SQLAlchemy Row objects to dictionaries matching the schema
        # The query result should directly map to ReviewedCardSummary schema fields
        return results

    except Exception as e:
        logger.error(f"Error fetching reviewed card summaries for {current_user.email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch reviewed card summaries")

@app.get("/auth/check-email", response_model=dict)
@limiter.limit("20/minute") 
def check_email_exists(request: Request, email: str, db: Session = Depends(get_db)):
    """Check if an email is already registered in the system.
    This endpoint helps the frontend determine whether to show login or registration UI."""
    
    logger.info(f"Checking if email exists: {email}")
    
    # Search for the user with this email
    user = db.query(models.User).filter(models.User.email == email).first()
    
    # Return a simple response indicating whether the email exists
    # We intentionally don't include any user details for security
    return {"exists": user is not None}

# --- NEW Prioritized Card Fetching Endpoint --- 
PRIORITY_LEVELS = {
    "highest": 5,
    "high": 4,
    "normal": 3,
    "low": 2,
    "off": 0
}

# Define valid priority strings for validation
class PriorityLevel(str, Enum):
    highest = "highest"
    high = "high"
    normal = "normal"
    low = "low"
    off = "off"

@app.get("/cards/next/", response_model=Optional[Card]) # Return Card or None
@limiter.limit("100/minute") # Apply rate limiting
def get_next_card_prioritized(
    request: Request,
    # Priority query parameters with defaults
    priority_new: PriorityLevel = PriorityLevel.normal,
    priority_again: PriorityLevel = PriorityLevel.highest,
    priority_hard: PriorityLevel = PriorityLevel.high,
    priority_good: PriorityLevel = PriorityLevel.normal,
    priority_easy: PriorityLevel = PriorityLevel.low,
    exclude_card_id: Optional[int] = Query(None, description="ID of the card to exclude from results."),
    # Dependencies
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetches the single next card based on user-defined priorities (level by level) and SRS schedule."""
    logger.info(f"GET /cards/next/ - User: {current_user.email} - Priorities: new={priority_new}, again={priority_again}, hard={priority_hard}, good={priority_good}, easy={priority_easy}")
    
    try:
        priorities_config = {
            "new": priority_new.value,
            1: priority_again.value, # Again
            2: priority_hard.value,  # Hard
            3: priority_good.value,  # Good
            4: priority_easy.value   # Easy
        }
        
        # Determine the order of priority levels to check (highest to lowest)
        # Group ratings by their priority level string
        priority_groups = defaultdict(list)
        for rating, level_str in priorities_config.items():
            if level_str != PriorityLevel.off:
                priority_groups[level_str].append(rating)
        
        # Sort priority levels from highest to lowest
        priority_order = sorted(priority_groups.keys(), key=lambda level: PRIORITY_LEVELS[level], reverse=True)
        logger.debug(f"Priority check order for {current_user.email}: {priority_order}")

        now = datetime.utcnow()
        found_card = None
        found_progress = None

        # --- Iterate through priority levels (Highest -> Low) --- 
        for level in priority_order:
            ratings_at_this_level = priority_groups[level]
            logger.info(f"Checking priority level: {level} (Ratings: {ratings_at_this_level})")
            
            # --- Check Due Cards at this priority level --- 
            if any(isinstance(r, int) for r in ratings_at_this_level): # Check if any are actual ratings (1-4)
                due_ratings = [r for r in ratings_at_this_level if isinstance(r, int)]
                logger.debug(f"Querying for due cards with ratings: {due_ratings}")
                
                due_progress_query = db.query(models.UserProgress).\
                    filter(models.UserProgress.user_id == current_user.id).\
                    filter(models.UserProgress.next_review <= now).\
                    filter(models.UserProgress.rating.in_(due_ratings)) # Match ratings for this level
                
                if exclude_card_id is not None:
                    due_progress_query = due_progress_query.filter(models.UserProgress.card_id != exclude_card_id)
                    
                # Order by how overdue they are (most overdue first)
                # Use next_review directly (ascending order is oldest first)
                best_due_progress = due_progress_query.order_by(models.UserProgress.next_review.asc()).options(joinedload(models.UserProgress.card)).first()
                
                if best_due_progress:
                    logger.info(f"Found DUE card {best_due_progress.card_id} at priority level {level}")
                    found_card = best_due_progress.card
                    found_progress = best_due_progress
                    break # Found the highest priority card, exit loop
                else:
                    logger.debug(f"No DUE cards found at priority level {level}")
           
            # --- Check New Cards (if 'new' is at this priority level) --- 
            if "new" in ratings_at_this_level:
                logger.debug("Querying for NEW cards at this priority level")
                # Subquery to find card IDs already reviewed by the current user
                user_progress_subquery = db.query(models.UserProgress.card_id).\
                    filter(models.UserProgress.user_id == current_user.id).\
                    subquery()
                    
                # Find cards that haven't been reviewed by this user
                new_cards_query = db.query(models.Card).\
                    outerjoin(user_progress_subquery, models.Card.id == user_progress_subquery.c.card_id).\
                    filter(user_progress_subquery.c.card_id == None)
                
                if exclude_card_id is not None:
                    new_cards_query = new_cards_query.filter(models.Card.id != exclude_card_id)
                
                # Fetch one random new card
                best_new_card = new_cards_query.order_by(func.random()).first()
                
                if best_new_card:
                    logger.info(f"Found NEW card {best_new_card.id} at priority level {level}")
                    found_card = best_new_card
                    found_progress = None # No progress record for new cards
                    break # Found the highest priority card, exit loop
                else:
                    logger.debug(f"No NEW cards found at priority level {level}")

        # --- End of loop --- 

        if not found_card:
            logger.info(f"User {current_user.email} - No cards found matching any active priorities.")
            return None

        logger.info(f"User {current_user.email} - Selected card ID {found_card.id}")

        # Convert the selected card to the API response format
        api_card = db_card_to_api_card(found_card, found_progress)
        return api_card

    except Exception as e:
        logger.error(f"User {current_user.email} - Error in get_next_card_prioritized: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error fetching next prioritized card")

# --- New Endpoint: Fetch Cards by Last Rating ---
@app.get("/cards/by-rating/", response_model=List[Card])
@limiter.limit("100/minute")
def get_cards_by_rating(
    request: Request,
    rating: int = Query(..., description="Rating value to filter by (1=Again, 2=Hard, etc.)"),
    match_history: bool = Query(False, description="If true, match if rating exists anywhere in history, ordered by last review."),
    exclude_card_id: Optional[int] = Query(None, description="ID of the card to exclude from results."),
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetches cards based on rating. Can match last rating (default) or rating history."""
    logger.info(f"GET /cards/by-rating/ - User: {current_user.email} - Rating: {rating} - Match History: {match_history} - Limit: {limit}")
    try:
        query = db.query(models.UserProgress).\
            filter(models.UserProgress.user_id == current_user.id)

        # Add exclusion filter if provided
        if exclude_card_id is not None:
            logger.info(f"Excluding card ID: {exclude_card_id}")
            query = query.filter(models.UserProgress.card_id != exclude_card_id)

        # Determine if we should use the Python fallback explicitly for SQLite
        use_python_fallback = False
        if match_history and engine.dialect.name == 'sqlite':
            logger.warning("SQLite detected with match_history=True. Using Python filtering fallback for reliability.")
            use_python_fallback = True

        if match_history and not use_python_fallback:
            # --- Try efficient DB-level JSON query (for PostgreSQL, etc.) ---
            logger.info(f"Filtering based on rating {rating} existing in history (DB query attempt).")
            try:
                query = query.filter(cast(models.UserProgress.rating_history, JSON).contains(rating)) # Check for the number itself
                query = query.order_by(models.UserProgress.last_review.desc().nullslast())
                records = query.limit(limit).all()
                logger.info(f"DB JSON query returned {len(records)} records.")
                
            except Exception as json_e:
                logger.error(f"Database JSON contains operation failed: {json_e}. Switching to Python fallback.")
                use_python_fallback = True # Force fallback if DB query fails

        if use_python_fallback:
             # --- Python Fallback Logic (for SQLite or if DB query failed) ---
             logger.info("Executing Python fallback for match_history filtering.")
             # Fetch all potentially relevant records, ordered by last review
             all_progress = query.order_by(models.UserProgress.last_review.desc().nullslast()).all()
             logger.debug(f"Fetched {len(all_progress)} total records for Python filtering.")
             
             # Filter in Python
             filtered_records = []
             for p in all_progress:
                 # Check if rating_history is a list and contains the target rating number
                 if isinstance(p.rating_history, list) and rating in p.rating_history:
                     filtered_records.append(p)
                     logger.debug(f"  ✓ Card {p.card_id} included (history: {p.rating_history})")
                 else:
                     logger.debug(f"  ✗ Card {p.card_id} excluded (history: {p.rating_history})")
             
             # Apply limit *after* filtering
             records = filtered_records[:limit]
             logger.info(f"Python fallback found {len(records)} matching records (after limit).")

        elif not match_history:
            # --- Match only the last rating (original logic) --- 
            logger.info(f"Filtering based on last rating being {rating}.")
            query = query.filter(models.UserProgress.rating == rating)
            query = query.order_by(models.UserProgress.next_review.asc().nullslast())
            records = query.limit(limit).all()

        # --- Process the selected records (either from DB query or Python fallback) ---
        cards = []
        # Make sure 'records' is defined; it might not be if only match_history was true and the DB query succeeded but returned 0
        if 'records' not in locals():
            records = [] # Ensure records is an empty list if no path set it
            
        for progress in records:
            if progress.card:
                cards.append(db_card_to_api_card(progress.card, progress))
                
        logger.info(f"FINAL: Returning {len(cards)} cards for rating {rating} (match_history={match_history})")
        return cards
        
    except Exception as e:
        logger.error(f"Error fetching cards by rating {rating} (match_history={match_history}) for {current_user.email}: {type(e).__name__} - {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error fetching cards by rating")

# --- New Endpoint: Get Count of Reviews Today --- 
@app.get("/users/me/progress/today-count", response_model=dict)
@limiter.limit("100/minute") # Apply standard rate limit
def get_todays_review_count(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Calculates and returns the number of cards reviewed by the user since midnight UTC today."""
    logger.info(f"GET /users/me/progress/today-count - User: {current_user.email}")
    try:
        # Get the current time in UTC
        now_utc = datetime.utcnow()
        # Determine the start of today (midnight) in UTC
        start_of_today_utc = datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0)
        
        logger.debug(f"Calculating reviews since: {start_of_today_utc.isoformat()} UTC")
        
        # Query the count of UserProgress records for the current user
        # where the last_review timestamp is on or after the start of today UTC
        review_count = db.query(func.count(models.UserProgress.id)).\
            filter(
                models.UserProgress.user_id == current_user.id,
                models.UserProgress.last_review >= start_of_today_utc
            ).\
            scalar()
            
        logger.info(f"Found {review_count} reviews for user {current_user.email} since {start_of_today_utc.isoformat()} UTC")
        
        return {"count": review_count}
    
    except Exception as e:
        logger.error(f"Error calculating today's review count for {current_user.email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error calculating today's review count")

# --- Authlib OAuth Configuration --- # Added Block Start
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
FRONTEND_CALLBACK_URL = os.getenv("FRONTEND_CALLBACK_URL", "http://localhost:3000/auth/callback") # Default if not set

# Add debug prints
print(f"DEBUG: GOOGLE_CLIENT_ID exists? {'Yes' if GOOGLE_CLIENT_ID else 'No'}")
if GOOGLE_CLIENT_ID:
    print(f"DEBUG: GOOGLE_CLIENT_ID length: {len(GOOGLE_CLIENT_ID)}")
    print(f"DEBUG: GOOGLE_CLIENT_ID first chars: {GOOGLE_CLIENT_ID[:8]}...")

print(f"DEBUG: GOOGLE_CLIENT_SECRET exists? {'Yes' if GOOGLE_CLIENT_SECRET else 'No'}")
if GOOGLE_CLIENT_SECRET:
    print(f"DEBUG: GOOGLE_CLIENT_SECRET length: {len(GOOGLE_CLIENT_SECRET)}")
    print(f"DEBUG: GOOGLE_CLIENT_SECRET first chars: {GOOGLE_CLIENT_SECRET[:4]}...")

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    print("WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables not set. Google login will not work.")
    # Optionally, raise an error or handle this case appropriately
    # raise ValueError("Missing Google OAuth Credentials in environment variables")

oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)
# --- Authlib OAuth Configuration --- # Added Block End

# --- Google OAuth Login Route --- # Added
@app.get('/auth/google/login')
async def login_via_google(request: Request):
    # Define the redirect URI for Google to call back to *this* backend endpoint
    # Must match one listed in Google Cloud Console "Authorized redirect URIs"
    backend_callback_uri = request.url_for('auth_via_google')
    print(f"Redirecting to Google. Backend Callback URI: {backend_callback_uri}")
    return await oauth.google.authorize_redirect(request, str(backend_callback_uri))

# --- Google OAuth Callback Route --- # Added
@app.get('/auth/google/callback', name='auth_via_google') # Name used in url_for above
async def auth_via_google(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
        print("Received token from Google:", token) # Be careful logging tokens, even access tokens
    except OAuthError as error:
        print(f"OAuth Error: {error.error} - {error.description}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f'Google OAuth Error: {error.error}')
    except Exception as e:
        print(f"Error authorizing access token: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to authorize with Google")

    user_info = token.get('userinfo')
    if not user_info:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not retrieve user info from Google token")

    google_email = user_info.get('email')
    google_id = user_info.get('sub') # 'sub' is the standard OIDC field for user ID
    # google_name = user_info.get('name') # Optional: use if needed

    if not google_email or not google_id:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing email or ID in Google user info")

    print(f"Google User Info: email={google_email}, google_id={google_id}")

    # --- Find or Create User ---
    db_user = crud.get_user_by_email(db, email=google_email)

    if db_user:
        # User exists, check if Google ID needs linking
        if not db_user.google_id:
            print(f"Linking existing user {google_email} with Google ID {google_id}")
            db_user.google_id = google_id
            db.commit()
            db.refresh(db_user)
        elif db_user.google_id != google_id:
            # This case is problematic - same email, different google ID? Should not happen with Google.
             print(f"Warning: Email {google_email} already linked to a different Google ID.")
             # Decide how to handle: block login, allow login, etc. For now, allow.
             pass
    else:
        # User does not exist, create a new one
        print(f"Creating new user for {google_email} with Google ID {google_id}")
        # Create user with proper schema
        user_data = UserCreate(email=google_email, password=None)
        print(f"Created UserCreate schema with email={user_data.email}")
        db_user = crud.create_user_google(db=db, user_email=google_email, google_id=google_id)
        if not db_user:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create new user")

    # --- Generate App Token ---
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )

    # --- Redirect to Frontend ---
    # Pass the token back to the frontend via query parameter
    frontend_redirect_url = f"{FRONTEND_CALLBACK_URL}?token={access_token}&token_type=bearer"
    print(f"Redirecting to frontend: {frontend_redirect_url}")
    return RedirectResponse(url=frontend_redirect_url)

logger.info("=== FASTAPI APP FULLY CONFIGURED ===")