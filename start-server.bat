@echo off
echo.
echo ========================================
echo   Serveur local La Meute Normande
echo ========================================
echo.
echo Le site sera accessible sur:
echo   http://localhost:8000
echo.
echo Appuyez sur Ctrl+C pour arreter
echo.

cd /d "%~dp0"
python -m http.server 8000

pause
