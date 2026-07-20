@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js ainda nao esta instalado. Instale a versao LTS e execute novamente.
  start https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Preparando o aplicativo pela primeira vez...
  call npm install || exit /b 1
)
echo Abrindo o Rotina Pet...
call npm run dev -- --host
pause
