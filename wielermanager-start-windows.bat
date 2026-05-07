@echo off
echo Wieler Manager wordt opgestart...
start cmd /k "cd backend && node src/app.js"
start cmd /k "cd frontend && npm run dev"
