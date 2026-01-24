#!/usr/bin/env python3
"""
Web Application for PDF Renaming
Flask-based web app that allows users to upload PDFs and get suggested names
"""

import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from pdf_processor import PDFProcessor

# PyInstaller compatibility: templates/static relative to bundle/extracted dir
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "uploads"

app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = str(UPLOAD_DIR)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Allowed extensions
ALLOWED_EXTENSIONS = {'pdf'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


processor = PDFProcessor()


@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    """Handle PDF upload and return suggested names"""
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected'}), 400
    
    results = []
    
    for file in files:
        if not allowed_file(file.filename):
            results.append({
                'original_name': file.filename,
                'success': False,
                'error': 'Invalid file type. Only PDF files are allowed.'
            })
            continue
        
        try:
            # Save uploaded file temporarily
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            analysis = processor.analyze(
                filepath,
                original_filename=file.filename,
                verbose=False,
            )

            result = {
                "success": bool(analysis.get("success")),
                "original_name": file.filename,
                "suggested_name": analysis.get("suggested_name"),
                "candidates": analysis.get("candidates", {}),
                "defaults": analysis.get("defaults", {}),
                "notes": analysis.get("notes", []),
                "text_chars": analysis.get("text_chars", 0),
            }
            
            # Clean up temporary file
            try:
                os.remove(filepath)
            except:
                pass
            
            results.append(result)
            
        except Exception as e:
            results.append({
                'original_name': file.filename,
                'success': False,
                'error': str(e)
            })
    
    return jsonify({'results': results})


@app.route('/api/download/<filename>')
def download_file(filename):
    """Download a file (if needed for future features)"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n🌐 Servidor iniciado en http://localhost:{port}")
    print("   Presiona Ctrl+C para detener el servidor\n")
    app.run(debug=True, host='127.0.0.1', port=port)
