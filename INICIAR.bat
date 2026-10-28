@echo off
cd /d "%~dp0"
echo Iniciando o Viaje Mais... abra http://localhost:3000 no navegador.
start "" http://localhost:3000
node server.js
pause
