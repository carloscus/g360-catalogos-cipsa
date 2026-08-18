@echo off
REM ============================================================
REM  g360-catalogos-CIPSA - Generador de paginas de catalogo
REM  Ejecuta la generacion de imagenes desde los PDFs.
REM ============================================================
setlocal enabledelayedexpansion

cd /d "%~dp0\.."

echo.
echo  ============================================
echo   Generador de paginas - g360-catalogos-CIPSA
echo  ============================================
echo.

REM --- Verificar Python ---
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado en el PATH.
    echo Instala Python desde https://www.python.org/downloads/
    echo y marca la opcion "Add Python to PATH".
    pause
    exit /b 1
)

REM --- Verificar dependencias ---
echo [*] Verificando dependencias (pymupdf, pillow)...
python -c "import pymupdf, PIL" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Instalando dependencias...
    python -m pip install --upgrade pip
    python -m pip install pymupdf pillow
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar las dependencias.
        pause
        exit /b 1
    )
)

REM --- Procesar argumentos ---
set "EXTRA="
if "%~1"=="" (
    echo [*] Generando TODOS los catalogos...
) else (
    echo [*] Generando solo: %*
    set "EXTRA=--only %*"
)

echo.
python tools\generate_pages.py %EXTRA%
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo la generacion de imagenes.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Generacion completada correctamente.
echo  ============================================
echo.
echo  Opciones utiles:
echo    generate_pages.bat vinifan        - solo un catalogo
echo    generate_pages.bat viniball       - solo VINIBALL
echo    python tools\generate_pages.py --dry-run   - simular
echo.
pause
