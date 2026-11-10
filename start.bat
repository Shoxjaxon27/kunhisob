@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title KunHisob

if not exist "package.json" goto :nozip
where node >nul 2>nul
if errorlevel 1 goto :nonode
node -e "var v=process.versions.node.split('.').map(Number);var ok=v[0]>=24||(v[0]===22&&v[1]>=12)||(v[0]===20&&v[1]>=19);process.exit(ok?0:1)"
if errorlevel 1 goto :oldnode
goto :install

:nozip
echo [XATO] package.json topilmadi. Zip faylni avval papkaga to'liq oching (Extract All), keyin start.bat ni shu papkadan ishga tushiring.
goto :fail

:nonode
echo [XATO] Node.js topilmadi. https://nodejs.org saytidan LTS versiyasini o'rnating va start.bat ni qayta ishga tushiring.
goto :fail

:oldnode
echo [XATO] Node.js versiyasi eski. Kerak: 20.19+, 22.12+ yoki 24+. https://nodejs.org dan LTS ni o'rnating.
node -v
goto :fail

:install
if not exist node_modules goto :doinstall
if exist "node_modules\.finova-ok" goto :env
goto :doinstall

:doinstall
echo Birinchi ishga tushirish: paketlar o'rnatilmoqda, bir necha daqiqa kuting...
rem --ignore-scripts: better-sqlite3 tayyor fayl bilan keladi, Visual Studio kerak emas.
call npm install --ignore-scripts
if errorlevel 1 goto :npmfail
echo Prisma tayyorlanmoqda...
call npx prisma generate
if errorlevel 1 goto :npmfail
echo ok> "node_modules\.finova-ok"
goto :env

:npmfail
echo.
echo [XATO] O'rnatish muvaffaqiyatsiz tugadi. Yuqoridagi xabarni o'qing va menga yuboring.
goto :fail

:env
if exist .env goto :migrate
copy .env.example .env >nul
echo .env fayli yaratildi.

:migrate
echo Baza yangilanmoqda...
call npm run db:migrate
if errorlevel 1 goto :migfail
goto :run

:migfail
echo.
echo [XATO] Bazani yangilashda xatolik. Yuqoridagi xabarni o'qing va menga yuboring.
goto :fail

:run
if not exist ".next\BUILD_ID" goto :build
if exist ".next\kunhisob-glass-v2" goto :serve

:build
echo KunHisob birinchi ishga tushirish uchun tayyorlanmoqda...
call npm run build
if errorlevel 1 goto :fail
echo ok> ".next\kunhisob-glass-v2"

:serve
echo.
echo KunHisob ishga tushmoqda: http://localhost:3000
echo To'xtatish uchun Ctrl+C bosing yoki oynani yoping.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
call npm run start -- -H 127.0.0.1
echo.
echo Server to'xtadi.

:fail
echo.
pause
exit /b 1
