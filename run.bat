@echo off
cd /d "%~dp0"
chcp 65001 > nul
title QUAN LY HO SO - TRUNG TAM DIEU HANH
color 0B

:MENU
cls
echo =======================================================================
echo               HE THONG QUAN LY HO SO DIA CHINH - MENU CHINH
echo =======================================================================
echo   1. Cai dat va kiem tra moi truong (npm install)
echo   2. Khoi dong ung dung (npm run dev)
echo   3. Dong goi thanh file cai dat .EXE (electron-builder)
echo   4. Thoat
echo =======================================================================
echo.
set /p choice=Chon thao tac (1-4): 

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto RUNDEV
if "%choice%"=="3" goto BUILDEXE
if "%choice%"=="4" goto EXIT

echo Lựa chọn không hợp lệ. Vui lòng chọn từ 1 đến 4!
timeout /t 2 >nul
goto MENU

:INSTALL
cls
echo [1/3] Kiem tra Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Chua co Node.js tren may tinh! Vui long cai dat Node.js tai https://nodejs.org
    pause
    goto MENU
)
echo [2/3] Kiem tra NPM...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Chua co NPM!
    pause
    goto MENU
)
echo [3/3] Dang cai dat cac thu vien phu thuoc (npm install)...
call npm install
echo.
echo === CAI DAT HOAN TAT! ===
pause
goto MENU

:RUNDEV
cls
echo Dang khoi dong ung dung...
call npm run dev
pause
goto MENU

:BUILDEXE
cls
echo Dang dong goi ung dung thanh file .EXE...
call npm run electron:build
echo.
echo === DONG GOI HOAN TAT! File nam trong thu muc release/ ===
if exist "release" explorer release
pause
goto MENU

:EXIT
exit
