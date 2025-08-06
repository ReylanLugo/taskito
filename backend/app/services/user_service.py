from fastapi import status
from fastapi.exceptions import HTTPException
from typing import Optional, cast
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserPasswordUpdate, TokenData
from app.config import settings
import logging

class UserService:
    """
    Service class for handling user-related business logic.

    Attributes:
        db: SQLAlchemy database session
    """

    def __init__(self, db: Session):
        """
        Initialize the UserService with a database session.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def get_user_by_id(self, user_id: int):
        """
        Retrieve a user by their ID.
        
        Args:
            user_id: The ID of the user to retrieve
            
        Returns:
            User object if found, None otherwise
        """
        try:
            user: Optional[User] = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logging.error(f"User not found (id={user_id})")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error retrieving user by ID: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        return user

    def get_user_by_username(self, username: str | None = None) -> Optional[User]:
        """
        Retrieve a user by their username.
        
        Args:
            username: The username to search for
            
        Returns:
            User object if found, None otherwise
        """
        try:
            if username is None:
                return None
            
            user: Optional[User] = self.db.query(User).filter(User.username == username.lower()).first()
            if not user:
                logging.error(f"User not found (username={username})")
                return None
        except Exception as e:
            logging.error(f"Error retrieving user by username: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        return user

    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Retrieve a user by their email address.
        
        Args:
            email: The email address to search for
            
        Returns:
            User object if found, None otherwise
        """
        try:
            user: Optional[User] = self.db.query(User).filter(User.email == email.lower()).first()
            if not user:
                logging.error(f"User not found (email={email})")
                return None
        except Exception as e:
            logging.error(f"Error retrieving user by email: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        return user

    def create_user(self, user_data: UserCreate) -> User:
        """
        Create a new user with hashed password.
        
        Args:
            user_data: UserCreate schema with user information
            
        Returns:
            Created User object
        """
        try:
            hashed_password = self._hash_password(user_data.password)
        
            db_user = User(
                username=user_data.username.lower(),
                email=user_data.email.lower(),
                hashed_password=hashed_password,
                role=user_data.role
            )
        
            self.db.add(db_user)
            self.db.commit()
            self.db.refresh(db_user)

            logging.info(f"User created (id={db_user.id}, username={db_user.username})")
            return db_user
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error creating user: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def update_user(self, user_id: int, user_update: UserUpdate) -> Optional[User]:
        """
        Update an existing user.
        
        Args:
            user_id: ID of the user to update
            user_update: UserUpdate schema with updated fields
            
        Returns:
            Updated User object if found, None otherwise
        """
        
        try:
            db_user = self.get_user_by_id(user_id)
        except HTTPException as e:
            if e.status_code == 404:
                return None
            raise
        

        try:
            update_data = user_update.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if field == 'username' and value:
                    value = value.lower()
                elif field == 'email' and value:
                    value = value.lower()
                setattr(db_user, field, value)
            
            self.db.commit()
            self.db.refresh(db_user)
            logging.info(f"User updated (id={user_id}, username={db_user.username}")
            return db_user
        except Exception as e:
            logging.error(f"Error updating user {user_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def update_user_password(self, user_id: int, password_update: UserPasswordUpdate):
        """
        Update a user's password after verifying the current password.
        
        Args:
            user_id: ID of the user
            password_update: UserPasswordUpdate schema with passwords
            
        Returns:
            True if password was updated, False otherwise
        """
        try:
            db_user = self.get_user_by_id(user_id)
        
            # Verify current password
            if not self._verify_password(password_update.current_password, cast(str, db_user.hashed_password)):
                return False
        
            # Update to new password
            db_user.hashed_password = self._hash_password(password_update.new_password)
            self.db.commit()
        
            logging.info(f"User password updated (id={user_id}, username={db_user.username})")
            return True
        except Exception as e:
            logging.error(f"Error updating user password {user_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def deactivate_user(self, user_id: int):
        """
        Deactivate a user account.
        
        Args:
            user_id: ID of the user to deactivate
            
        Returns:
            True if user was deactivated
        """
        try:
            db_user = self.get_user_by_id(user_id)
        
            db_user.is_active = False
            self.db.commit()
        
            logging.info(f"User deactivated (id={user_id}, username={db_user.username})")
            return True
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error deactivating user {user_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def activate_user(self, user_id: int):
        """
        Activate a user account.
        
        Args:
            user_id: ID of the user to activate
            
        Returns:
            True if user was activated
        """
        try:
            db_user = self.get_user_by_id(user_id)
        
            db_user.is_active = True
            self.db.commit()
        
            logging.info(f"User activated (id={user_id}, username={db_user.username})")
            return True
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error activating user {user_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """
        Authenticate a user by username and password.
        
        Args:
            username: Username
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        try:
            user = self.get_user_by_username(username)
        
            if not user:
                return None
        
            if not self._verify_password(password, cast(str, user.hashed_password)):
                logging.info(f"User authentication failed (username={username})")
                return None
        
            logging.info(f"User authenticated (username={username})")
            return user
        except Exception as e:
            logging.error(f"Error authenticating user {username}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT access token.
        
        Args:
            data: Data to encode in the token
            expires_delta: Token expiration time
            
        Returns:
            Encoded JWT token
        """
        try:
            to_encode = data.copy()
            if expires_delta:
                expire = datetime.utcnow() + expires_delta
            else:
                expire = datetime.utcnow() + timedelta(minutes=15)
        
            to_encode.update({"exp": expire})
            encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
        
            logging.info(f"Access token created (username={data['sub']})")
            return encoded_jwt
        except Exception as e:
            logging.error(f"Error creating access token: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def create_refresh_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT refresh token.
        
        Args:
            data: Data to encode in the token
            expires_delta: Token expiration time
            
        Returns:
            Encoded JWT refresh token
        """
        try:
            to_encode = data.copy()
            if expires_delta:
                expire = datetime.utcnow() + expires_delta
            else:
                expire = datetime.utcnow() + timedelta(minutes=settings.refresh_token_expire_minutes)
            to_encode.update({"exp": expire, "type": "refresh"})
            encoded_jwt = jwt.encode(to_encode, settings.refresh_token_secret, algorithm=settings.algorithm)
            return encoded_jwt
        except Exception as e:
            logging.error(f"Error creating refresh token: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def verify_token(self, token: str) -> Optional[TokenData]:
        """
        Verify and decode a JWT token.
        
        Args:
            token: JWT token to verify
            
        Returns:
            TokenData if valid, None otherwise
        """
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            username_from_payload = payload.get("sub")

            if not isinstance(username_from_payload, str):
                logging.error(f"Invalid token payload: 'sub' is not a string or is missing (token={token})")
                return None

            username: str = username_from_payload
            
            logging.info(f"Token verified (username={username})")
            return TokenData(username=username)
        except JWTError:
            logging.error(f"Invalid token (token={token})")
            return None
        except Exception as e:
            logging.error(f"Error verifying token (token={token}): {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def verify_refresh_token(self, token: str) -> Optional[TokenData]:
        """
        Verify and decode a JWT refresh token.
        
        Args:
            token: JWT refresh token to verify
            
        Returns:
            TokenData if valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                settings.refresh_token_secret,
                algorithms=[settings.algorithm]
            )
            if payload.get("type") != "refresh":
                logging.error(f"Invalid token type: expected refresh token (token={token})")
                return None
            
            if payload.get("sub") is None:
                logging.error(f"Invalid token payload: 'sub' is missing (token={token})")
                return None
            
            username: str = str(payload.get("sub"))
            
            logging.info(f"Refresh token verified (username={username})")
            return TokenData(username=username)
        except JWTError:
            logging.error(f"Invalid refresh token (token={token})")
            return None
        except Exception as e:
            logging.error(f"Error verifying refresh token (token={token}): {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def is_username_available(self, username: str, exclude_user_id: Optional[int] = None) -> bool:
        """
        Check if a username is available.
        
        Args:
            username: Username to check
            exclude_user_id: User ID to exclude from check (for updates)
            
        Returns:
            True if username is available, False otherwise
        """
        try:
            query = self.db.query(User).filter(User.username == username.lower())
            if exclude_user_id:
                query = query.filter(User.id != exclude_user_id)
            
            userExists: bool = query.first() is None
            if userExists:
                logging.info(f"Username available (username={username})")
            else:
                logging.info(f"Username not available (username={username})")
            return userExists
        except Exception as e:
            logging.error(f"Error checking username availability (username={username}): {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def is_email_available(self, email: str, exclude_user_id: Optional[int] = None) -> bool:
        """
        Check if an email is available.
        
        Args:
            email: Email to check
            exclude_user_id: User ID to exclude from check (for updates)
            
        Returns:
            True if email is available, False otherwise
        """
        try:
            query = self.db.query(User).filter(User.email == email.lower())
            if exclude_user_id:
                query = query.filter(User.id != exclude_user_id)
            
            userExists: bool = query.first() is None
            if userExists:
                logging.info(f"Email available (email={email})")
            else:
                logging.info(f"Email not available (email={email})")
            return userExists
        except Exception as e:
            logging.error(f"Error checking email availability (email={email}): {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def _hash_password(self, password: str) -> str:
        """
        Hash a password using bcrypt.
        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password
        """
        try:
            return self.pwd_context.hash(password)
        except Exception as e:
            logging.error(f"Error hashing password: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash.
        
        Args:
            plain_password: Plain text password
            hashed_password: Hashed password
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            return self.pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logging.error(f"Error verifying password: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
