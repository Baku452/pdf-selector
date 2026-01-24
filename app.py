#!/usr/bin/env python3
"""
Web Application for PDF Renaming
Flask-based web app that allows users to upload PDFs and get suggested names
"""

import os
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from pdf_processor import PDFProcessor

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
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
            
            # Generate suggested name (pass original filename for fallback extraction)
            suggested_name, metadata = processor.generate_filename_parts(
                filepath, 
                verbose=False, 
                original_filename=file.filename
            )
            
            if suggested_name:
                result = {
                    'success': True,
                    'suggested_name': suggested_name,
                    'original_name': file.filename,
                    'metadata': metadata or {}
                }
            else:
                result = {
                    'success': False,
                    'suggested_name': None,
                    'original_name': file.filename,
                    'message': 'No se pudo extraer información suficiente del PDF'
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
    app.run(debug=True, host='0.0.0.0', port=port)
