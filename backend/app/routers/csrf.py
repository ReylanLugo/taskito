"""
CSRF Token Management Endpoints
"""
from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import JSONResponse
from app.middleware.csrf import csrf_generator
from app.dependencies.auth import get_current_active_user
from app.schemas.user import User

router = APIRouter(prefix="/csrf", tags=["CSRF"])


@router.get("/token")
async def get_csrf_token(
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate a new CSRF token for the authenticated user.
    
    This endpoint returns a new CSRF token that should be included
    in the X-CSRF-Token header for state-changing requests.
    
    Returns:
        - csrf_token: The raw CSRF token to use in headers
        - signed_token: The signed token for the cookie
    """
    try:
        csrf_token = csrf_generator.generate_token()
        signed_token = csrf_generator.create_signed_cookie(csrf_token)
        
        response = JSONResponse({
            "csrf_token": csrf_token,
            "message": "CSRF token generated successfully"
        })
        
        # Set the CSRF cookie
        response.set_cookie(
            key="csrf_token",
            value=signed_token,
            httponly=True, 
            secure=True,
            samesite="strict",
            max_age=3600,
            path="/"
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating CSRF token: {str(e)}"
        )


@router.get("/validate")
async def validate_csrf_token(
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """
    Validate the current CSRF token.
    
    This endpoint can be used by the frontend to check if the
    current CSRF token is still valid.
    
    Returns:
        - valid: Boolean indicating if the token is valid
        - message: Descriptive message
    """
    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("x-csrf-token")
    
    if not cookie_token or not header_token:
        return {"valid": False, "message": "Missing CSRF token"}
    
    return {
        "valid": True,
        "message": "CSRF tokens present and will be validated on state-changing requests"
    }
