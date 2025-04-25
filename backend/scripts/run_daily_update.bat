@echo off
cd /d "%~dp0"
call ..\venv\Scripts\activate.bat
python update_values.py >> daily_update.log 2>&1
deactivate 