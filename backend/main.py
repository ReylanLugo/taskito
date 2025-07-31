import os
import logging
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from app.database import engine
from app.loki_handler import setup_logging

# Load environment variables from .env file
load_dotenv()
setup_logging()

app = FastAPI(title="Taskito API", description="A simple API for Taskito")

@app.get("/", tags=["Root"])
async def root():
    return JSONResponse(content={
        "message": "Hello World",
    })

@app.get("/health", tags=["Health"])
async def health_check():
    logging.info("Health check endpoint was called.")
    health = {"database": False}
    # Verificar conexión a base de datos reutilizando engine
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        health["database"] = True
        logging.info("Database connection is healthy.")
    except Exception as e:
        health["database"] = False
        logging.error("Database connection is not healthy. Error: %s", e)
    status = "ok" if all(health.values()) else "degraded"
    return JSONResponse(content={"status": status, **health})

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
