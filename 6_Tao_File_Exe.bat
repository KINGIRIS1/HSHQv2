@echo off
cd /d "%~dp0"
chcp 65001 > nul
title TAO FILE CAI DAT (.EXE) - QUAN LY HO SO
color 0F
echo ==================================================
echo   DANG DONG GOI UNG DUNG THANH FILE SETUP (.EXE)
echo   Qua trinh nay co the mat tu 2 - 5 phut...
echo   Vui long khong tat cua so nay!
echo ==================================================
echo.
call npm run electron:build
echo.
echo ==================================================
echo   DA DONG GOI THANH CONG!
echo   File cai dat (.exe) nam trong thu muc: release/
echo ==================================================
pause
