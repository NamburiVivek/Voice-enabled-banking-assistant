"""
main.py - FastAPI application entry point.
Security measures applied at the app level:
  🔒 CORS with explicit allowed origins
  🔒 Security headers (CSP, HSTS, X-Frame-Options, etc.)
  🔒 Global rate limiting via slowapi
  🔒 Debug mode off
  🔒 Structured error handling (no stack traces in responses)
"""
import logging
import os
import sys
from contextlib import asynccontextmanager

# ── Ensure backend and backend/ai directories are in Python path ──────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.join(BASE_DIR, "ai")
for p in (AI_DIR, BASE_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

# Cap PyTorch thread buffers to prevent OOM on single-core / low-memory containers
try:
    import torch
    torch.set_num_threads(1)
except Exception:
    pass

from fastapi import FastAPI, Request, status, HTTPException as FastAPIHTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from config import get_settings
from routers import auth, banking, voice

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


# ── Security Headers Middleware ───────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """🔒 Adds security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=()"
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self';"
        )
        # 🔒 Remove server fingerprint
        if "server" in response.headers:
            del response.headers["server"]
        return response


# ── Rate Limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_GLOBAL])


# ── App Factory ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Voxa Bank AI API starting up")
    # Non-blocking background warmup for AI pipeline
    # Enables immediate port binding on cloud hosts while pre-warming the model
    try:
        import threading
        from routers.voice import get_assistant

        warmup_thread = threading.Thread(
            target=get_assistant,
            name="AssistantWarmupThread",
            daemon=True,
        )
        warmup_thread.start()
        logger.info("🧠 Voxa Bank AI Assistant background warmup initiated")
    except Exception as e:
        logger.warning("Voice Assistant warmup skipped: %s", e)

    yield
    logger.info("🛑 Voxa Bank AI API shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=False,                   # 🔒 NEVER enable debug in production
    docs_url="/api/docs" if settings.DEBUG else None,   # 🔒 Hide docs in prod
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Middlewares (order matters — outermost = added LAST) ───────────────────────

# 1. Security headers (inner)
app.add_middleware(SecurityHeadersMiddleware)

# 2. Rate limiting (middle)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# 3. CORS — outermost (added last so CORS headers are added to ALL responses)
# Supports localhost, custom domains from ALLOWED_ORIGINS, and ANY *.vercel.app deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if settings.ALLOWED_ORIGINS else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


# ── Global Exception Handlers ─────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """🔒 Never expose internal error details or stack traces to the client."""
    if isinstance(exc, (FastAPIHTTPException, StarletteHTTPException)):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
        )
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again later."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(banking.router)
app.include_router(voice.router)


# ── Root & Health Check ───────────────────────────────────────────────────────

@app.get("/", tags=["root"])
async def root():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "endpoints": {
            "health": "/api/health",
            "voice": "/api/voice/chat",
            "auth": "/api/auth",
            "banking": "/api/banking",
        },
    }


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok", "service": settings.APP_NAME}
