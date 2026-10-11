"""
database.py - Supabase async database connection.
Uses the service-role key for server-side operations — NEVER exposed to the client.
"""
from supabase import create_client, Client
from config import get_settings

_client: Client | None = None


def get_db() -> Client:
    """Return a singleton Supabase client (service role for server ops)."""
    global _client
    settings = get_settings()
    if _client is None:
        _client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,   # 🔒 service role — server only
        )
    return _client
