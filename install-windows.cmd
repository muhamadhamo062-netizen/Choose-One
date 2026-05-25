@echo off
cd /d "%~dp0"
echo Installing npm dependencies and Prisma client...
call npm install
if errorlevel 1 exit /b 1
call npx prisma generate
echo Done. You can run: npm run dev  or  npm run build
pause
