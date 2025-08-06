from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to responses."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        csp = (
            "default-src 'self'; "
            "script-src 'self' https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js "
            "'sha256-1I8qOd6RIfaPInCv8Ivv4j+J0C6d7I8+th40S5U/TVc='; " # this will change if the docker image is rebuilt
            "style-src 'self' https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css; "
            "img-src 'self' https://fastapi.tiangolo.com; "
            "frame-ancestors 'none'"
        )
        response.headers["Content-Security-Policy"] = csp
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response