@echo off
echo =======================================================
echo  Smart Traffic Management System — OpenCV Standalone
echo =======================================================
echo.
echo Starting OpenCV Real-Time Traffic Detection Window...
cd /d "%~dp0"
call venv\Scripts\activate
python main.py
pause
