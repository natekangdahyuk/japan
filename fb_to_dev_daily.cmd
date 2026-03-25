@echo off
REM 매일 새벽 작업 스케줄러용 — Firebase → 이 PC (npm run fb-to-dev)
REM 작업 스케줄러: 프로그램 cmd.exe / 인수: /c "이 파일의 전체 경로"
REM       또는 "시작 위치" = 이 저장소 루트, 프로그램 = 이 cmd 전체 경로
REM Node(npm)가 PATH 에 있어야 합니다. 로그는 logs\fb_to_dev.log

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
