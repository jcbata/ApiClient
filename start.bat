@echo off
TITLE API Client - Starter

echo ==========================================
echo Iniciando API Client (Servidor y Cliente)
echo ==========================================

echo.
echo [1/2] Iniciando Servidor...
start "Servidor - Puerto 3001" cmd /k "title Servidor - Puerto 3001 && cd server && node index.js"

echo [2/2] Iniciando Cliente...
start "Cliente - Vite" cmd /k "title Cliente - Vite && cd client && npm run dev"

echo.
echo ==========================================
echo  Servidor y Cliente arrancando...
echo ==========================================
echo.
echo  Para acceder desde OTRA PC en la red:
echo  1. Busca tu IP local con: ipconfig ^| find "IPv4"
echo  2. Abre en el navegador: http://[TU_IP]:5173
echo.
echo  Ejemplo: http://192.168.1.100:5173
echo.
echo  El frontend ya esta configurado para
echo  comunicarse con el backend en el mismo IP.
echo.
pause
