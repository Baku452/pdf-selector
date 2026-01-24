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
python app.py
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
4. Click "Procesar PDFs" to get suggested names
5. View the suggested filenames based on extracted content

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
├── pdf_renamer.py           # Original CLI version
├── templates/
│   └── index.html           # Web interface
├── static/
│   ├── style.css            # Styling
│   └── app.js               # Frontend JavaScript
├── uploads/                 # Temporary upload folder (auto-created)
└── pdf-renamer-requirements.txt
```

## Notes

- Uploaded files are processed temporarily and deleted after processing
- Maximum file size: 100MB per file
- The app processes the first 3 pages for OCR to optimize performance
