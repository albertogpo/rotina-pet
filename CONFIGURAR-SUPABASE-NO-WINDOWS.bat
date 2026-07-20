@echo off
cd /d "%~dp0"
set /p SUPABASE_URL=Cole a Project URL do Supabase: 
set /p SUPABASE_KEY=Cole a Publishable key (sb_publishable_...): 
if "%SUPABASE_URL%"=="" goto invalid
if "%SUPABASE_KEY%"=="" goto invalid
(
  echo VITE_SUPABASE_URL=%SUPABASE_URL%
  echo VITE_SUPABASE_PUBLISHABLE_KEY=%SUPABASE_KEY%
) > .env.local
echo Configuracao salva. Agora abra INICIAR-NO-WINDOWS.bat.
pause
exit /b 0
:invalid
echo A URL e a chave sao obrigatorias. Nada foi alterado.
pause
exit /b 1
