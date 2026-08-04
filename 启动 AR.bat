@echo off
chcp 65001 >nul
title 粒子交互AI教学 - 启动中...
echo.
echo   ╔══════════════════════════════════════╗
echo   ║     粒子交互AI教学 ｜ 长晴科技      ║
echo   ╚══════════════════════════════════════╝
echo.
echo   正在启动本地HTTP服务器...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Start-LocalServer.ps1"
pause
