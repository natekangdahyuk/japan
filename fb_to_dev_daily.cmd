@echo off
chcp 65001 >nul
REM Task Scheduler: Firebase -> local (npm run fb-to-dev)
REM Use: cmd /c "full path to this file"  OR  Start in: repo root
REM Node/npm must be on PATH. Output: logs\fb_to_dev.log

setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%" || exit /b 1

if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set "LOG=%ROOT%logs\fb_to_dev.log"

echo ===== %date% %time% =====>> "%LOG%"
call npm run fb-to-dev >> "%LOG%" 2>&1
set "ERR=%ERRORLEVEL%"
echo.>> "%LOG%"
exit /b %ERR%
