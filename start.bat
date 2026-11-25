@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist data mkdir data
echo Spoustim Slophoot na http://localhost:3000
call npm run dev
pause
