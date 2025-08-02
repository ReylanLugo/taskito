import os
import logging
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import engine
from app.loki_handler import setup_logging
from app.routers import tasks
from app.routers import auth
from app.schemas.main import HealthCheckResponse

# Load environment variables from .env file
load_dotenv()
setup_logging()

app = FastAPI(title="Taskito API", description="A simple API for Taskito")

# Include routers
app.include_router(tasks.router)
app.include_router(auth.router)

@app.get("/", tags=["Root"])
async def root():
    return JSONResponse(content={
        "message": "Hello World",
    })

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
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
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
