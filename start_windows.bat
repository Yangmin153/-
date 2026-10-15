@echo off
chcp 65001 > nul
cd /d "%~dp0"
if not exist .venv (py -m venv .venv)
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if not exist .env (
  copy .env.example .env > nul
  echo.
  echo [설정 필요] .env 파일을 열고 네이버 클라우드 Client ID / Client Secret을 넣어주세요.
)
start "" http://127.0.0.1:8000
python -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
