from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    breeze_api_key: str = ""
    breeze_api_secret: str = ""
    breeze_session_token: str = ""
    class Config:
        env_file = ".env"

settings = Settings() 