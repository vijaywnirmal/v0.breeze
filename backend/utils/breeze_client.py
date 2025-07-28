from breeze_connect import BreezeConnect
from backend.config import settings
import logging

def get_breeze_client(api_key=None, api_secret=None, session_token=None):
    api_key = api_key or settings.breeze_api_key
    api_secret = api_secret or settings.breeze_api_secret
    session_token = session_token or settings.breeze_session_token
    try:
        breeze = BreezeConnect(api_key=api_key)
        breeze.generate_session(api_secret=api_secret, session_token=session_token)
        return breeze
    except Exception as e:
        logging.error(f"Failed to initialize BreezeConnect: {e}")
        raise 