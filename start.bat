@echo off
TITLE API Client - Starter

echo ==========================================
echo Iniciando API Client (Servidor y Cliente)
echo ==========================================

echo.
echo [1/2] Iniciando Servidor...
:: Abre una nueva ventana, cambia al directorio server y ejecuta node index.js
start "Servidor - Puerto 3001" cmd /k "cd server && node index.js"

echo [2/2] Iniciando Cliente...
:: Abre una nueva ventana, cambia al directorio client y ejecuta npm run dev
start "Cliente - Vite" cmd /k "cd client && npm run dev"

echo.
echo Servidor y Cliente estan arrancando en ventanas separadas.
echo Puedes cerrar esta ventana.
pause
