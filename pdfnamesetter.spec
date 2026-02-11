# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from pathlib import Path

block_cipher = None

# Find Tesseract and Poppler paths on Windows
tesseract_path = os.environ.get('TESSERACT_PATH', r'C:\Program Files\Tesseract-OCR')
poppler_path = os.environ.get('POPPLER_PATH', r'C:\poppler\Library\bin')
tessdata_path = os.path.join(tesseract_path, 'tessdata')

extra_binaries = []
extra_datas = []

# Bundle Tesseract (exe and all DLL dependencies)
if os.path.isdir(tesseract_path):
    for f in os.listdir(tesseract_path):
        fp = os.path.join(tesseract_path, f)
        if os.path.isfile(fp) and (f.endswith('.exe') or f.endswith('.dll')):
            extra_binaries.append((fp, 'tesseract'))

# Bundle tessdata (language files)
if os.path.isdir(tessdata_path):
    for f in os.listdir(tessdata_path):
        fp = os.path.join(tessdata_path, f)
        if os.path.isfile(fp) and (f.startswith('spa') or f.startswith('eng') or f in ('osd.traineddata', 'pdf.ttf')):
            extra_datas.append((fp, 'tesseract/tessdata'))

# Bundle Poppler binaries (exe and all DLL dependencies)
if os.path.isdir(poppler_path):
    for f in os.listdir(poppler_path):
        fp = os.path.join(poppler_path, f)
        if os.path.isfile(fp) and (f.endswith('.exe') or f.endswith('.dll')):
            extra_binaries.append((fp, 'poppler'))

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=extra_binaries,
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ] + extra_datas,
    hiddenimports=[
        'flask',
        'werkzeug',
        'jinja2',
        'fitz',
        'pytesseract',
        'pdf2image',
        'PIL',
        'webview',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PDFNameSetter',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Enable console for debugging
    disable_windowed_traceback=False,
    argv_emulation=False,
    icon=None,
)
