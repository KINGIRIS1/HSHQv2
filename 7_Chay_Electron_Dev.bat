@echo off
cd /d "%~dp0"
chcp 65001 > nul
title CHAY thư ELECTRON DEV - QUAN LY HO SO
color 0B
echo ==================================================
echo   DANG KHOI DONG ELECTRON TRONG CHE DO DEV...
echo ==================================================
echo.
call npm run electron:dev
pause
