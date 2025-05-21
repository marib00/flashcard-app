from sqlalchemy.orm import Session
from . import models  # Update import to use relative import

def get_user(db: Session, email: str) -> models.User:
    return db.query(models.User).filter(models.User.email == email).first()

# Add an alias for the get_user function to match the name used in main.py
get_user_by_email = get_user

# NEW function for Google users
def create_user_google(db: Session, user_email: str, google_id: str) -> models.User:
    """Creates a new user who signed up via Google."""
    db_user = models.User(
        email=user_email, 
        google_id=google_id, 
        hashed_password=None # Explicitly None for Google-only users
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    print(f"CRUD: Created Google user {user_email}")
    return db_user

# Function to get user by ID (You might have this)
# def get_user(db: Session, user_id: int): 