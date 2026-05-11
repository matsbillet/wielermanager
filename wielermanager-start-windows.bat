@echo off
setlocal
echo ====================================================
echo   Wielermanager: Controle en Start
echo ====================================================

:: 1. Controleer backend dependencies
if not exist "backend\node_modules\" (
    echo [BACKEND] Pakketten ontbreken. Installeren...
    cd backend && call npm install && cd ..
    echo [BACKEND] Installatie voltooid.
) else (
    echo [BACKEND] Pakketten zijn al aanwezig.
)

:: 2. Controleer frontend dependencies
if not exist "frontend\node_modules\" (
    echo [FRONTEND] Pakketten ontbreken. Installeren...
    cd frontend && call npm install && cd ..
    echo [FRONTEND] Installatie voltooid.
) else (
    echo [FRONTEND] Pakketten zijn al aanwezig.
)

echo.
echo Starten van de servers...

:: 3. Start Backend
start cmd /k "cd backend && node src/app.js"

:: 4. Start Frontend
start cmd /k "cd frontend && npm run dev"

:: 5. Wachten en browser openen
echo Even wachten tot de server is opgestart...
timeout /t 5 /nobreak > nul

echo Open browser...
start http://localhost:5173

echo Alles is opgestart! Je kunt dit venster sluiten.
pause
