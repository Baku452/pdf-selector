#!/usr/bin/env python3
"""
Web Application for PDF Renaming
Flask-based web app that allows users to upload PDFs and get suggested names
"""

import os
import sys
import shutil
import zipfile
import io
import uuid
import threading
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory, send_file
from werkzeug.utils import secure_filename
from pdf_processor import PDFProcessor

# PyInstaller compatibility: templates/static relative to bundle/extracted dir
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(os.path.abspath(__file__)).parent))
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
# Use /tmp for uploads on Vercel (read-only filesystem), local dir otherwise
UPLOAD_DIR = Path("/tmp/pdfns_uploads") if os.environ.get("VERCEL") else BASE_DIR / "uploads"

app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path="/static",
)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = str(UPLOAD_DIR)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Allowed extensions
ALLOWED_EXTENSIONS = {'pdf'}


def allowed_file(filename):
    return (
        '.' in filename and
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    )


processor = PDFProcessor()


@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')


def _session_dir(session_id):
    """Directory where this session's PDFs are stored."""
    path = Path(app.config['UPLOAD_FOLDER']) / str(session_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_download_filename(name):
    """Sanitize filename for Content-Disposition (evitar caracteres problemáticos)."""
    if not name or not name.strip():
        return "documento.pdf"
    name = name.strip()
    if not name.lower().endswith('.pdf'):
        name = name + '.pdf'
    return ''.join(c for c in name if c.isalnum() or c in ' ._-()').strip() or 'documento.pdf'


@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    """Handle PDF upload and return suggested names. Keeps files for download."""
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    files = request.files.getlist('files')

    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected'}), 400

    session_id = str(uuid.uuid4())
    session_path = _session_dir(session_id)
    results = []
    file_index = 0

    for file in files:
        if not allowed_file(file.filename):
            results.append({
                'original_name': file.filename,
                'success': False,
                'error': 'Invalid file type. Only PDF files are allowed.',
                'file_index': None,
            })
            continue

        try:
            # Save under session folder as 0.pdf, 1.pdf, ...
            stem = str(file_index)
            filepath = session_path / f"{stem}.pdf"
            file.save(str(filepath))

            analysis = processor.analyze(
                str(filepath),
                original_filename=file.filename,
                verbose=True,  # Enable verbose for debugging
            )

            result = {
                "success": bool(analysis.get("success")),
                "original_name": file.filename,
                "suggested_name": analysis.get("suggested_name"),
                "candidates": analysis.get("candidates", {}),
                "defaults": analysis.get("defaults", {}),
                "notes": analysis.get("notes", []),
                "text_chars": analysis.get("text_chars", 0),
                "file_index": file_index,
            }
            results.append(result)
            file_index += 1

        except Exception as e:
            results.append({
                'original_name': file.filename,
                'success': False,
                'error': str(e),
                'file_index': None,
            })

    return jsonify({'session_id': session_id, 'results': results})


@app.route('/api/download/<session_id>/<int:file_index>')
def download_file(session_id, file_index):
    """Download one PDF with the chosen filename (Content-Disposition)."""
    filename = request.args.get('filename', '').strip()
    filename = _safe_download_filename(filename)

    session_path = Path(app.config['UPLOAD_FOLDER']) / str(session_id)
    path = session_path / f"{file_index}.pdf"
    if not path.is_file():
        return jsonify({'error': 'File not found or expired'}), 404

    try:
        return send_file(
            path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf',
        )
    finally:
        try:
            path.unlink()
        except Exception:
            pass


@app.route('/api/download-zip', methods=['POST'])
def download_zip():
    """Download a ZIP with all PDFs renamed. Body: { session_id, files: [ { index, filename } ] }"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON body required'}), 400
    session_id = data.get('session_id')
    files = data.get('files')
    if not session_id or not isinstance(files, list):
        return jsonify({'error': 'session_id and files (array) required'}), 400

    session_path = Path(app.config['UPLOAD_FOLDER']) / str(session_id)
    if not session_path.is_dir():
        return jsonify({'error': 'Session not found or expired'}), 404

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for item in files:
            idx = item.get('index')
            name = _safe_download_filename(item.get('filename', ''))
            if idx is None:
                continue
            path = session_path / f"{idx}.pdf"
            if path.is_file():
                zf.write(path, name)

    buf.seek(0)
    try:
        shutil.rmtree(session_path, ignore_errors=True)
    except Exception:
        pass

    return send_file(
        buf,
        as_attachment=True,
        download_name='PDFNameSetter_descargas.zip',
        mimetype='application/zip',
    )


def start_server(port):
    """Start Flask in a background thread (used by desktop mode)."""
    app.run(debug=False, host='127.0.0.1', port=port, use_reloader=False)


class Api:
    """pywebview JS-to-Python bridge for native file operations."""

    def save_file(self, session_id, file_index, filename):
        """Open native Save As dialog and copy the PDF with the new name."""
        import webview

        session_path = Path(app.config['UPLOAD_FOLDER']) / str(session_id)
        source = session_path / f"{file_index}.pdf"
        if not source.is_file():
            return {'error': 'Archivo no encontrado o sesion expirada'}

        safe_name = _safe_download_filename(filename)
        windows = webview.windows
        if not windows:
            return {'error': 'No hay ventana disponible'}

        result = windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=safe_name,
            file_types=('PDF Files (*.pdf)',),
        )

        if not result:
            return {'cancelled': True}

        dest = result if isinstance(result, str) else result[0]
        try:
            shutil.copy2(str(source), dest)
            return {'ok': True, 'path': dest}
        except Exception as e:
            return {'error': str(e)}

    def save_zip(self, session_id, files_json):
        """Open native Save As dialog and save a ZIP with renamed PDFs."""
        import webview
        import json

        files = json.loads(files_json) if isinstance(files_json, str) else files_json
        session_path = Path(app.config['UPLOAD_FOLDER']) / str(session_id)
        if not session_path.is_dir():
            return {'error': 'Sesion no encontrada o expirada'}

        windows = webview.windows
        if not windows:
            return {'error': 'No hay ventana disponible'}

        result = windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename='PDFNameSetter_descargas.zip',
            file_types=('ZIP Files (*.zip)',),
        )

        if not result:
            return {'cancelled': True}

        dest = result if isinstance(result, str) else result[0]
        try:
            with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
                for item in files:
                    idx = item.get('index')
                    name = _safe_download_filename(item.get('filename', ''))
                    if idx is None:
                        continue
                    path = session_path / f"{idx}.pdf"
                    if path.is_file():
                        zf.write(path, name)
            return {'ok': True, 'path': dest}
        except Exception as e:
            return {'error': str(e)}


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    is_bundled = getattr(sys, 'frozen', False)

    if is_bundled:
        # Desktop mode: open native window with pywebview
        import webview
        api = Api()
        t = threading.Thread(target=start_server, args=(port,), daemon=True)
        t.start()
        webview.create_window(
            'PDFNameSetter',
            f'http://localhost:{port}',
            width=1100,
            height=750,
            min_size=(800, 500),
            js_api=api,
        )
        webview.start()
    else:
        # Dev mode: normal Flask server
        print(f"\nServidor iniciado en http://localhost:{port}")
        print("   Presiona Ctrl+C para detener el servidor\n")
        app.run(debug=True, host='127.0.0.1', port=port)
