@echo off
cd /d "%~dp0"
chcp 65001 > nul
title DONG GOI UNG DUNG EXE - HE THONG QLHS
color 0F

echo =========================================================
echo       TIEN TRINH XUAT BAN GOI CAI DAT (.EXE)
echo =========================================================
echo.

:: 1. Kiem tra moi truong Node.js va npm
echo [1/5] Kiem tra moi truong Node.js & npm...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu https://nodejs.org truoc khi build.
    goto :THAT_BAI
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [LOI] Khong tim thay trinh quan ly goi npm!
    goto :THAT_BAI
)
echo      - Node.js va npm da san sang.

:: 2. Dong cac tien trinh dang chay de tranh khoa thu muc build
echo.
echo [2/5] Kiem tra va dong cac tien trinh ung dung dang mo...
taskkill /f /im "electron.exe" >nul 2>nul
taskkill /f /im "Quan Ly Ho So.exe" >nul 2>nul
echo      - Hoan tat don dep tien trinh.

:: 3. Kiem tra thu vien dependencies
echo.
echo [3/5] Kiem tra thu vien (node_modules)...
if not exist "node_modules\" (
    echo      - node_modules chua ton tai, dang cai dat thu vien...
    call npm install --no-audit --no-fund
) else (
    echo      - Thu vien node_modules da san sang.
)

:: 4. Bien dich giao dien Frontend (Build dist)
echo.
echo [4/5] Bien dich ma nguon giao dien (Frontend Build)...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [LOI] Qua trinh "npm run build" that bai. Vui long kiem tra loi code!
    goto :THAT_BAI
)

:: 5. Dong goi ung dung sang Electron Setup .exe
echo.
echo [5/5] Dang dong goi bo cai dat (.exe) qua Electron Builder...
echo      (Qua trinh nay co the mat tu 2 - 5 phut, vui long cho)
call npm run electron:build
if %errorlevel% neq 0 (
    color 0C
    echo [LOI] Dong goi that bai tai buoc "electron:build".
    goto :THAT_BAI
)

:: Thong bao thanh cong
color 0A
echo.
echo =========================================================
echo               XUAT BAN .EXE THANH CONG!
echo =========================================================
echo File cai dat (.exe) da duoc tao trong thu muc: "release\"
echo.
if exist "release\" (
    explorer "release"
)
pause
exit /b 0

:THAT_BAI
echo.
echo =========================================================
echo               QUA TRINH DONG GOI THAT BAI!
echo =========================================================
echo Vui long kiem tra lai thong bao loi mau do phia tren.
echo.
pause
exit /b 1
