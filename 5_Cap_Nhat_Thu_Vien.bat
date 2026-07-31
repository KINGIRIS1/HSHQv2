@echo off
cd /d "%~dp0"
chcp 65001 > nul
title CAP NHAT THU VIEN - QUAN LY HO SO
color 0D
echo ==================================================
echo   DANG CAP NHAT THU VIEN (NPM INSTALL)...
echo   Luu y: Lenh nay KHONG LAM XOA du lieu cua ban.
echo ==================================================
echo.
call npm install
echo.
echo ==================================================
echo   DA CAP NHAT HOAN TAT!
echo ==================================================
pause
