@echo off
chcp 65001 >nul
title GameGoal Launcher
echo GameGoal 서버를 시작합니다... (창이 여러 개 열립니다)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
