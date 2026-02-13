@echo off
echo ==========================================
echo   PDF Name Setter - Windows Build Script
echo ==========================================
echo.

REM Check if Tesseract path is set, otherwise use default
if "%TESSERACT_PATH%"=="" (
    set TESSERACT_PATH=C:\Program Files\Tesseract-OCR
    echo Using default Tesseract path: %TESSERACT_PATH%
) else (
    echo Using Tesseract path from environment: %TESSERACT_PATH%
)

REM Check if Poppler path is set, otherwise use default
if "%POPPLER_PATH%"=="" (
    set POPPLER_PATH=C:\poppler\Library\bin
    echo Using default Poppler path: %POPPLER_PATH%
) else (
    echo Using Poppler path from environment: %POPPLER_PATH%
)

echo.

REM Verify paths exist
if not exist "%TESSERACT_PATH%" (
    echo ERROR: Tesseract directory not found at: %TESSERACT_PATH%
    echo Please install Tesseract or set TESSERACT_PATH environment variable
    echo Download from: https://github.com/UB-Mannheim/tesseract/wiki
    pause
    exit /b 1
)

if not exist "%POPPLER_PATH%" (
    echo ERROR: Poppler directory not found at: %POPPLER_PATH%
    echo Please install Poppler or set POPPLER_PATH environment variable
    echo Download from: https://github.com/oschwartz10612/poppler-windows/releases
    pause
    exit /b 1
)

echo Paths verified successfully!
echo.

REM Install dependencies
echo Installing Python dependencies...
pip install -r pdf-renamer-requirements.txt
pip install pyinstaller pywebview

echo.
echo Building executable...
pyinstaller pdfnamesetter.spec

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo   Build completed successfully!
    echo   Executable location: dist\PDF_Renombrar_Archivos.exe
    echo ==========================================
) else (
    echo.
    echo ==========================================
    echo   Build failed! Check errors above.
    echo ==========================================
)

pause
