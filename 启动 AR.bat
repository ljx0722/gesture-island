@echo off
chcp 65001 >nul 2>&1
title 粒子交互AI教学

cd /d "%~dp0"

echo.
echo   ============================================
echo     粒子交互AI教学 v2.0
echo     上海长晴人工智能科技有限公司
echo   ============================================
echo.

REM Find available port
set PORT=4173
:check_port
netstat -ano 2>nul | findstr /C:":%PORT% " | findstr /C:"LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    set /a PORT=%PORT%+1
    if %PORT% GTR 4190 goto :check_port
    goto :check_port
)

echo   [OK] 端口 %PORT% 可用
echo.

REM Try Python3 first
set PY_CMD=
python3 --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=python3
    goto :start_server
)

REM Try Python
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=python
    goto :start_server
)

REM Try PowerShell (non-admin bypass)
echo   Python not found, trying PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-LocalServer.ps1" -Port %PORT%
goto :end

:start_server
echo   Using %PY_CMD% to start HTTP server on port %PORT%
echo   Opening browser...
start "" "http://localhost:%PORT%"
echo.
echo   ============================================
echo     Server running at: http://localhost:%PORT%
echo     Press Ctrl+C to stop
echo   ============================================
%PY_CMD% -m http.server %PORT%

:end
pause
