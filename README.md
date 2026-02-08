# PDF Name Setter

A web application that intelligently renames PDF files based on their content. The app extracts information from PDFs (including scanned documents using OCR) and suggests meaningful filenames.

## Features

- 🌐 **Web Interface**: Beautiful, modern web UI with drag-and-drop functionality
- 📄 **Multiple PDF Support**: Upload and process multiple PDFs at once
- 🔍 **Smart Extraction**: Extracts dates, document types, reference numbers, and entity names
- 📝 **OCR Support**: Handles scanned PDFs using Tesseract OCR
- 🎨 **Modern UI**: Responsive design with smooth animations

## Requirements

- Python 3.7+
- Tesseract OCR installed on your system
  - macOS: `brew install tesseract tesseract-lang`
  - Linux: `sudo apt-get install tesseract-ocr tesseract-ocr-spa`
  - Windows: Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

## Installation

1. Install Python dependencies:
```bash
pip install -r pdf-renamer-requirements.txt
```

2. Ensure Tesseract OCR is installed and accessible in your PATH.

## Usage

1. Start the web server:
```bash
python run_web.py
```

2. Open your browser and navigate to:
```
http://localhost:5001
```

   Note: If port 5001 is also in use, you can set a custom port:
   ```bash
   PORT=8080 python app.py
   ```

3. Drag and drop PDF files or click to select them
4. Click "Procesar PDFs"
5. For each PDF, select the detected values (dropdown) and edit them (input)
6. Use **Descargar PDF** to get that file with the chosen name, or **Descargar todos (ZIP)** to get all PDFs in a ZIP with their new names.

---

## Cómo mandar el .exe a otra persona para que lo pruebe

1. **Generar el .exe (en Windows)**  
   - En una PC con Windows, instala Python 3.x, Tesseract y Poppler (ver requisitos abajo).  
   - En la carpeta del proyecto:
     ```bash
     pip install -r pdf-renamer-requirements.txt
     pip install pyinstaller
     pyinstaller --onefile --name PDFNameSetter --add-data "templates;templates" --add-data "static;static" run_web.py
     ```
   - El ejecutable queda en `dist\PDFNameSetter.exe`.

2. **Qué enviar**  
   - Envía el archivo **`PDFNameSetter.exe`** (carpeta `dist\`).  
   - La otra persona no necesita tener Python ni el código.

3. **Requisitos en la PC de la otra persona**  
   - **Windows** (mismo tipo de arquitectura: 64 bits si compilaste en 64 bits).  
   - **Tesseract OCR** instalado y en el PATH (para OCR en PDFs escaneados).  
     - Descarga: [Tesseract en GitHub](https://github.com/UB-Mannheim/tesseract/wiki).  
   - **Poppler** (para `pdf2image`): añadir la carpeta `bin` de Poppler al PATH.  
     - Sin Tesseract/Poppler la app puede seguir funcionando para PDFs con texto digital; el OCR fallará en escaneados.

4. **Cómo probar**  
   - Doble clic en `PDFNameSetter.exe`.  
   - Se abre el navegador en `http://127.0.0.1:5001`.  
   - Sube PDFs, ajusta nombres y usa **Descargar PDF** o **Descargar todos (ZIP)**.

5. **Antivirus**  
   - Algunos antivirus marcan .exe empaquetados con PyInstaller. Si es tu build, puedes añadir una excepción o firmar el ejecutable.

---

## Windows (.exe) build (PyInstaller)

Yes — you can distribute this as a Windows executable that starts the local web server and opens the browser.

**Important**: builds must be done on Windows to produce a Windows `.exe`.

### Prerequisites (Windows)

- **Python 3.x** installed
- **Tesseract OCR** installed and in PATH  
  - Recommended: UB Mannheim build (`https://github.com/UB-Mannheim/tesseract/wiki`)
- **Poppler** installed and in PATH (required by `pdf2image`)  
  - Add Poppler `bin` folder to PATH

### Build steps

```bash
pip install -r pdf-renamer-requirements.txt
pip install pyinstaller

pyinstaller --onefile --name PDFNameSetter ^
  --add-data "templates;templates" ^
  --add-data "static;static" ^
  run_web.py
```

Then run:
- `dist\\PDFNameSetter.exe`

---

## Desplegar en Vercel (y por qué suele “no funcionar”)

Esta app es un **servidor Flask** que:
- Sube archivos al servidor.
- Usa **Tesseract** y **Poppler** (binarios del sistema) para OCR y conversión de PDF a imagen.
- Usa **PyMuPDF** para leer PDFs.

En **Vercel** todo corre en **funciones serverless**: no hay proceso largo, no hay sistema de archivos persistente y **no hay Tesseract ni Poppler instalados** por defecto. Por eso, tal como está, **suele no funcionar** en Vercel (errores de “módulo no encontrado” o “comando no encontrado” al usar OCR/pdf2image).

### Opciones recomendadas

1. **Usar la app en local o con .exe**  
   - `python run_web.py` o el `PDFNameSetter.exe` en Windows.

2. **Desplegar en un VPS o PaaS con soporte Python completo**  
   - **Railway**, **Render**, **Fly.io**, **PythonAnywhere**, etc.  
   - Ahí puedes instalar Tesseract y Poppler y ejecutar Flask con `gunicorn` o `waitress`.

### Si aun así quieres probar en Vercel

- Vercel solo expone **funciones serverless** (y sitios estáticos). No puedes instalar Tesseract/Poppler en el entorno estándar.
- Podrías:
  - **Quitar OCR** y usar solo extracción de texto digital (PyMuPDF) y desplegar con `vercel build` + un handler serverless (por ejemplo `api/index.py` que envuelva la app con `serverless-wsgi`). Aun así, el límite de tiempo y tamaño de respuesta de Vercel puede cortar subidas o descargas grandes.
  - O **usar un servicio externo de OCR** por API y mantener en Vercel solo la lógica web; es un cambio grande de arquitectura.

**Resumen**: para que “funcione” igual que en local (con OCR y descarga de PDFs renombrados), lo adecuado es **no usar Vercel** y desplegar en un host donde puedas instalar dependencias del sistema (Railway, Render, etc.).

## How It Works

The application:
1. Extracts text from PDFs (digital text or OCR for scanned documents)
2. Identifies key information:
   - Dates (various formats)
   - Document types (invoice, receipt, contract, etc.)
   - Reference numbers
   - Entity names (companies, people)
3. Generates a suggested filename combining the extracted information

## Project Structure

```
PDFNameSetter/
├── app.py                    # Flask web application
├── run_web.py                # Entry point (opens browser)
├── pdf_renamer.py           # Original CLI version
├── pdf_processor.py          # Shared extraction logic
├── templates/
│   └── index.html           # Web interface
├── static/
│   ├── style.css            # Styling
│   └── app.js               # Frontend JavaScript
├── uploads/                 # Temporary upload folder (auto-created)
└── pdf-renamer-requirements.txt
```

## Notes

- Uploaded files are kept in a temporary session folder until you download them (single PDF or ZIP); after download they are removed.
- Maximum file size: 100MB per file
- The app processes the first 3 pages for OCR to optimize performance
