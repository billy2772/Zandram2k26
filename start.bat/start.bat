@echo off
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo ERROR: Node.js is still not installed or detected! Please install Node.js from https://nodejs.org/
  echo Make sure you restart your computer or VS Code after installing.
  pause
  exit
)

echo Success! Starting Zantram2K26 Server...
echo Do NOT close this window while you are testing the website!
timeout /t 3 /nobreak > NUL

:: Automatically open the browser to the correct server url
start http://127.0.0.1:5500/public/index.html
:: Start the server
node server.js
pause
