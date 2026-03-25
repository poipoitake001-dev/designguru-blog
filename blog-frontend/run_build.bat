@echo off
chcp 65001 >nul
cd /d "C:\Users\qq225\Desktop\新建文件夹 (2)\blog-frontend"
echo Current directory: %CD%
echo.
echo === Running npm run build ===
call npm run build 2>&1
set BUILDRC=%ERRORLEVEL%
echo.
echo === Build exit code: %BUILDRC% ===
exit /b %BUILDRC%
