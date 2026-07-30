@echo off
chcp 65001 > nul
title SERVER QUAN LY HO SO - LUU DU LIEU LAN
color 0C
echo ==================================================
echo   DANG KHOI DONG SERVER NOI BO (LAN)...
echo ==================================================
echo.
echo DIA CHI IP MAY CUA BAN:
ipconfig | findstr /i "IPv4"
echo.
echo ==================================================
echo   LUI Y: KHONG TAT CUA SO NAY KHI DANG LAM VIEC!
echo ==================================================
echo.
call npm run server
pause
