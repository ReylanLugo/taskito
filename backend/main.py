import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Taskito API", description="A simple API for Taskito")

@app.get("/", tags=["Root"])
async def root():
    return JSONResponse(content={
        "message": "Hello World",
        "postgres_host": os.getenv("POSTGRES_HOST", "localhost"),
        "redis_host": os.getenv("REDIS_HOST", "localhost")
    })

@app.get("/health", tags=["Health"])
async def health_check():
    return JSONResponse(content={"status": "ok"})

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
