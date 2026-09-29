@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   League Akari - one click launcher
echo ============================================
echo.

set "YARN_ENABLE_GLOBAL_CACHE=false"
set "YARN_CACHE_FOLDER=%~dp0.yarn\cache"
set "NODE_OPTIONS=--max-old-space-size=4096"

if not exist "out\main\main.js" goto build
if not exist "out\renderer\main-window.html" goto build
goto run

:build
echo [1/2] Build output not found. Building now, this may take several minutes...
echo.
call yarn build
if errorlevel 1 goto failed
echo.

:run
echo [2/2] Starting League Akari...
echo.
call yarn start
goto end

:failed
echo.
echo [ERROR] Build failed. Please read the messages above.
echo.
pause

:end
endlocal
