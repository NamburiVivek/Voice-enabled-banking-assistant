"""
Root entrypoint wrapper for VoxaBank FastAPI application.
Ensures uvicorn main:app works whether started from repository root or backend/ directory.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
AI_DIR = os.path.join(BACKEND_DIR, "ai")

for p in (AI_DIR, BACKEND_DIR, BASE_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.main import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
