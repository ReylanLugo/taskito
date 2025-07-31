from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Database settings
    postgres_user: str = os.getenv("POSTGRES_USER", "postgres")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: str = os.getenv("POSTGRES_PORT", "5432")
    postgres_db: str = os.getenv("POSTGRES_DB", "taskito")
    
    @property
    def database_url(self) -> str:
        """
        Generate SQLAlchemy database URL from environment variables
        """
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    # Redis settings
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    
    # API settings
    debug: bool = os.getenv("DEBUG", "True") == "True"
    secret_key: str = os.getenv("SECRET_KEY", "default_secret_key")
    
    class Config:
        env_file = ".env.local"
        env_file_encoding = "utf-8"


settings = Settings()
