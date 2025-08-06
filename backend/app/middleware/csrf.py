"""
CSRF Protection Middleware using Double Submit Cookie Pattern
"""
import secrets
import hmac
import hashlib
from typing import Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import settings


class CSRFDoubleSubmitMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection using Double Submit Cookie Pattern.
    
    This middleware:
    1. Sets a CSRF token in a secure cookie for GET requests
    2. Validates CSRF token for state-changing HTTP methods
    3. Uses secure cookie attributes (HttpOnly, Secure, SameSite)
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.csrf_cookie_name = "csrf_token"
        self.csrf_header_name = "X-CSRF-Token"
        self.secret_key = settings.secret_key.encode()
        
    def _generate_csrf_token(self) -> str:
        """Generate a secure random CSRF token."""
        return secrets.token_urlsafe(32)
    
    def _sign_token(self, token: str) -> str:
        """Create a signed version of the token."""
        signature = hmac.new(
            self.secret_key,
            token.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{token}:{signature}"
    
    def _verify_token(self, signed_token: str) -> Optional[str]:
        """Verify the signature and return the original token."""
        try:
            if ":" not in signed_token:
                return None
            
            token, signature = signed_token.split(":", 1)
            expected_signature = hmac.new(
                self.secret_key,
                token.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if hmac.compare_digest(signature, expected_signature):
                return token
            return None
        except Exception:
            return None
    
    def _should_skip_csrf(self, request: Request) -> bool:
        """Determine if CSRF check should be skipped."""
        # Skip for safe HTTP methods
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
            
        # Skip for authentication endpoints (they handle their own security)
        if request.url.path.startswith("/auth/"):
            return True
            
        # Skip if no Authorization header (public endpoints)
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return True
            
        return False

    def _should_set_csrf(self, request: Request) -> bool:
        """Determine if CSRF token should be set in response"""
        auth_header = request.headers.get("Authorization")
        return bool(
            request.method == "GET" 
            and not request.url.path.startswith("/auth/")
            and not request.url.path.startswith("/csrf/")
            and auth_header is not None
            and auth_header.startswith("Bearer ")
        )
    
    async def dispatch(self, request: Request, call_next):
        """Main middleware dispatch function."""
        
        # Handle state-changing requests
        if not self._should_skip_csrf(request):
            # Get tokens from cookie and header
            cookie_token = request.cookies.get(self.csrf_cookie_name)
            header_token = request.headers.get(self.csrf_header_name)
            
            if not cookie_token or not header_token:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF token missing"}
                )
            
            # Verify both tokens
            cookie_value = self._verify_token(cookie_token)
            if cookie_value != header_token:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Invalid CSRF token"}
                )
        
        # Process the request
        response = await call_next(request)
        
        # Set CSRF token for GET requests if authenticated
        if self._should_set_csrf(request):
            csrf_token = self._generate_csrf_token()
            signed_token = self._sign_token(csrf_token)
            
            # Set secure cookie
            response.set_cookie(
                key=self.csrf_cookie_name,
                value=signed_token,
                httponly=True,
                secure=True,
                samesite="strict",
                max_age=3600,
            )
            
            response.headers["X-CSRF-Token"] = csrf_token
            response.headers["Access-Control-Expose-Headers"] = "X-CSRF-Token"
        
        return response


# Dependency for manual CSRF token generation
class CSRFTokenGenerator:
    """Helper class for generating CSRF tokens."""
    
    def __init__(self):
        self.secret_key = settings.secret_key.encode()
    
    def generate_token(self) -> str:
        """Generate a new CSRF token."""
        return secrets.token_urlsafe(32)
    
    def create_signed_cookie(self, token: str) -> str:
        """Create a signed cookie value."""
        signature = hmac.new(
            self.secret_key,
            token.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{token}:{signature}"


csrf_generator = CSRFTokenGenerator()
