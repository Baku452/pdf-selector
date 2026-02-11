#!/usr/bin/env python3
"""Test simple del procesador de PDFs"""

from pdf_processor import PDFProcessor

# Ruta al PDF de prueba
pdf_path = r'c:\Users\aldai\Downloads\SKM_368e26013117570.pdf'

print("="*60)
print("PROBANDO EXTRACCIÓN DE PDF")
print("="*60)

# Crear procesador
processor = PDFProcessor()

# Analizar PDF con output verbose
print(f"\nAnalizando: {pdf_path}")
result = processor.analyze(pdf_path, verbose=True)

# Mostrar resultados
print("\n" + "="*60)
print("RESULTADOS")
print("="*60)

if result['success']:
    print(f"\n[OK] ÉXITO!")
    print(f"\nNombre sugerido: {result['suggested_name']}")
    print(f"\nCandidatos encontrados:")
    print(f"  - DNI: {result['candidates']['dni']}")
    print(f"  - Nombre: {result['candidates']['nombre']}")
    print(f"  - Empresa: {result['candidates']['empresa']}")
    print(f"  - Tipo: {result['candidates']['tipo_examen']}")
    print(f"  - Fecha: {result['candidates']['fecha']}")
else:
    print(f"\n[FAIL] ERROR:")
    for note in result['notes']:
        print(f"  - {note}")

print(f"\nCaracteres extraídos: {result['text_chars']}")
