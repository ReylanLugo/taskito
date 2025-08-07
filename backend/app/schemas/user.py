from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    """Base schema for user data"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: EmailStr = Field(..., description="User email address")
    role: UserRole = Field(UserRole.USER, description="User role")

    @field_validator('username')
    def validate_username(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Username cannot be empty')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, hyphens, and underscores')
        return v.strip().lower()


class UserCreate(UserBase):
    """Schema for creating a new user"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    password: str = Field(..., min_length=8, max_length=100, description="User password")

    @field_validator('password')
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserUpdate(BaseModel):
    """Schema for updating an existing user"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="Username")
    email: Optional[EmailStr] = Field(None, description="User email address")
    role: Optional[UserRole] = Field(None, description="User role")
    is_active: Optional[bool] = Field(None, description="User active status")

    @field_validator('username')
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Username cannot be empty')
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError('Username can only contain letters, numbers, hyphens, and underscores')
            return v.strip().lower()
        return v


class UserPasswordUpdate(BaseModel):
    """Schema for updating user password"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=100, description="New password")

    @field_validator('new_password')
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class User(UserBase):
    """Schema for user response"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    """Schema for authentication token"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(..., description="Token type")


class TokenData(BaseModel):
    """Schema for token data"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    username: Optional[str] = Field(None, description="Username from token")


class LoginRequest(BaseModel):
    """Schema for login request"""
    model_config = ConfigDict(from_attributes=True, extra='ignore')
    
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="User password")
