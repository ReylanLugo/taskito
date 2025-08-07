import os
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.database import engine
from app.loki_handler import setup_logging
from app.routers import tasks
from app.routers import auth
from app.routers import csrf
from app.schemas.main import HealthCheckResponse
from app.middleware import limiter, SecurityHeadersMiddleware, CSRFDoubleSubmitMiddleware
from app.config import settings
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

# Load environment variables from .env file
load_dotenv()
setup_logging()

app = FastAPI(title="Taskito API", description="A simple API for Taskito", root_path="/api")

# Add rate limiting state and error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add gzip middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["X-CSRF-Token", "Content-Type", "Authorization"],
    expose_headers=["X-CSRF-Token", "Content-Type", "Authorization", "Server", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"],
)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add CSRF protection middleware
app.add_middleware(CSRFDoubleSubmitMiddleware)

# Include routers
app.include_router(tasks.router)
app.include_router(auth.router)
app.include_router(csrf.router)


@app.get("/", tags=["Root"])
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}")
async def root(request: Request):
    return JSONResponse(content={
        "message": "Hello World",
    })

@app.get("/health", response_model=HealthCheckResponse)
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}")
async def health_check(request: Request):
    """Check the health of the application and its dependencies."""
    logging.info("Health check endpoint was called.")
    
    # Check database connection
    database_healthy = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database_healthy = True
        logging.info("Database connection is healthy")
    except Exception as e:
        logging.error(f"Database connection is not healthy. Error: {e}")
    status = "ok" if database_healthy else "degraded"
    return HealthCheckResponse(status=status, database=database_healthy)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, proxy_headers=True)
