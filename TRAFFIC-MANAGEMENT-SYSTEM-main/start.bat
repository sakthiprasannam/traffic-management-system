@echo off
echo ==========================================
echo  AI Traffic Management System - Startup
echo ==========================================

echo.
echo [1/3] Installing Python backend dependencies...
cd /d "%~dp0backend"
call ..\venv\Scripts\activate
pip install -r requirements.txt --quiet

echo.
echo [2/3] Starting FastAPI backend (port 8000)...
start "TrafficAI Backend" cmd /k "cd /d %~dp0backend && ..\venv\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo [3/3] Starting React frontend (port 5173)...
start "TrafficAI Frontend" cmd /k "cd /d %~dp0Traffic_management_system && npm run dev"

echo.
echo ==========================================
echo  Open: http://localhost:5173
echo  API Docs: http://localhost:8000/docs
echo  Login: admin / password123
echo ==========================================
pause
