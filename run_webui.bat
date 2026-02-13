@echo off
setlocal

cd /d "%~dp0"

set "PY_CMD="

if exist "venv\Scripts\python.exe" (
  set "PY_CMD=venv\Scripts\python.exe"
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    set "PY_CMD=py -3"
  ) else (
    where python >nul 2>nul
    if not errorlevel 1 (
      set "PY_CMD=python"
    )
  )
)

if "%PY_CMD%"=="" (
  echo [ERROR] Python not found.
  echo Install Python 3 and retry.
  exit /b 1
)

if not exist "requirements.txt" (
  echo [ERROR] requirements.txt not found in "%cd%".
  exit /b 1
)

echo [INFO] Using: %PY_CMD%
echo [INFO] Starting Web UI...
%PY_CMD% webui_server.py

endlocal
