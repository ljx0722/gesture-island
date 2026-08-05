@echo off
chcp 65001 >nul 2>&1
title 长晴手势实验岛

cd /d "%~dp0"

echo.
echo   ============================================
echo     长晴手势实验岛 v2.1
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
%PY_CMD% -c "import http.server,os; class H(http.server.SimpleHTTPRequestHandler): pass; [setattr(H,'end_headers',lambda s: [s.send_header('Cross-Origin-Opener-Policy','same-origin'), s.send_header('Cross-Origin-Embedder-Policy','require-corp'), http.server.SimpleHTTPRequestHandler.end_headers(s)])]; http.server.HTTPServer(('',%PORT%),H).serve_forever()"

:end
pause
