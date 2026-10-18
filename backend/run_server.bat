@echo off
echo ========================================================
echo Starting VoxaBank Backend (FastAPI + AI Assistant)
echo Target: http://127.0.0.1:8000
echo Python Runtime: Python 3.11 (with PyTorch NLU ^& Speech)
echo ========================================================

py -3.11 -m uvicorn main:app --reload --port 8000
if %errorlevel% neq 0 (
    python3.11 -m uvicorn main:app --reload --port 8000
)
pause
