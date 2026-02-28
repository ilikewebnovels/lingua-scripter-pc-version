@echo off
title Webnovel Translator Launcher

echo Building the application for production...
call npm run build

echo Starting the production server in a new window...
:: Use "start" to run the npm command in a new, non-blocking window
start "Production Server" npm start

echo.
echo Waiting 8 seconds for the server to initialize...
:: This timeout gives the server time to start before opening the browser
timeout /t 8 /nobreak >nul

echo Opening browser to http://localhost:3001/
start http://localhost:3001/

echo.
echo The production server should now be running in a separate window.
pause