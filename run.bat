@echo off
cd /d "%~dp0"
chcp 65001 > nul
title QUAN LY HO SO - TRUNG TAM DIEU HANH & DONG GOI EXE
color 0B

:MENU
cls
echo =======================================================================
echo         HE THONG QUAN LY HO SO DIA CHINH - TRUNG TAM DIEU HANH
echo =======================================================================
echo   1. Cai dat va lam sach thu vien (npm install / clean cache)
echo   2. Khoi dong ung dung web (npm run dev)
echo   3. Dong goi file Cài đặt .EXE (NSIS Setup - Khuyên dùng)
echo   4. Dong goi file Chạy ngay .EXE (Portable - Không cần cài đặt)
echo   5. Xuất dạng thư mục ứng dụng (Win Dir Unpacked)
echo   6. Xóa cache Electron-Builder (Khắc phục lỗi treo/mạng khi đóng gói)
echo   7. Thoát
echo =======================================================================
echo.
set /p choice=Chon thao tac (1-7): 

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto RUNDEV
if "%choice%"=="3" goto BUILDSETUP
if "%choice%"=="4" goto BUILDPORTABLE
if "%choice%"=="5" goto BUILDDIR
if "%choice%"=="6" goto CLEARCACHE
if "%choice%"=="7" goto EXIT

echo Lựa chọn không hợp lệ. Vui lòng chọn từ 1 đến 7!
timeout /t 2 >nul
goto MENU

:INSTALL
cls
echo [1/3] Kiem tra Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Chua co Node.js tren may tinh! Vui long cai dat tai https://nodejs.org
    pause
    goto MENU
)
echo [2/3] Xoa node_modules cu de tranh loi...
if exist "node_modules" rmdir /s /q "node_modules"
echo [3/3] Dang tai va cai dat lai toan bo thu vien (npm install)...
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

:BUILDSETUP
cls
echo =======================================================================
echo   DANG DONG GOI FILE CAI DAT SETUP (.EXE)
echo =======================================================================
if not exist "node_modules" (
    echo [!] Chua co thu vien. Dang tu dong chay Cai dat...
    call npm install
)
echo [1/2] Bien dich code...
call npm run build
echo [2/2] Tao file cai dat .EXE (NSIS)...
call npm run electron:build
goto CHECKRESULT

:BUILDPORTABLE
cls
echo =======================================================================
echo   DANG DONG GOI FILE CHAY NGAY PORTABLE (.EXE)
echo =======================================================================
if not exist "node_modules" call npm install
echo [1/2] Bien dich code...
call npm run build
echo [2/2] Tao file Portable .EXE...
call npm run electron:portable
goto CHECKRESULT

:BUILDDIR
cls
echo =======================================================================
echo   DANG XUAT THU MUC UNG DUNG (WIN DIR)
echo =======================================================================
if not exist "node_modules" call npm install
echo [1/2] Bien dich code...
call npm run build
echo [2/2] Tao thu muc...
call npm run electron:dir
goto CHECKRESULT

:CLEARCACHE
cls
echo Dang xoa cac thu muc cache tam cua Electron-Builder va Build...
if exist "release" rmdir /s /q "release"
if exist "dist" rmdir /s /q "dist"
echo Da lam sach cache thanh cong!
pause
goto MENU

:CHECKRESULT
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo =======================================================================
    echo [X] DONG GOI KHONG THANH CONG!
    echo Nguyên nhân & Khắc phục:
    echo - Nếu máy chưa có kết nối Internet ở lần đầu đóng gói, Electron-Builder
    echo   cần tải bộ khung NSIS/Electron. Vui lòng kết nối mạng và thử lại.
    echo - Chạy mục [6] để Xóa cache rồi chạy lại.
    echo =======================================================================
    pause
    color 0B
    goto MENU
)

color 0A
echo.
echo =======================================================================
echo   🎉 DONG GOI THANH CONG!
echo =======================================================================
echo File ket qua nam trong thu muc: release/
echo.
if exist "release" explorer release
pause
color 0B
goto MENU

:EXIT
exit
