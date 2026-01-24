#!/usr/bin/env python3
"""
Renombrador Inteligente de PDFs
Extrae información de PDFs (incluso escaneados) y los renombra automáticamente
"""

import os
import sys
from pathlib import Path
from pdf_processor import PDFProcessor

class PDFRenamer:
    def __init__(self, folder_path):
        self.folder_path = Path(folder_path)
        self.supported_extensions = ['.pdf']
        self.processor = PDFProcessor()
    
    def generate_filename(self, pdf_path):
        """Genera un nombre inteligente basado en el contenido"""
        print(f"\n📄 Procesando: {pdf_path.name}")
        
        suggested_name, metadata = self.processor.generate_filename_parts(pdf_path, verbose=True)
        
        if not suggested_name:
            print("  ⚠️  No se pudo extraer información suficiente")
            return None
        
        return suggested_name
    
    def rename_pdfs(self, dry_run=True):
        """Renombra todos los PDFs en la carpeta"""
        if not self.folder_path.exists():
            print(f"❌ La carpeta no existe: {self.folder_path}")
            return
        
        pdf_files = list(self.folder_path.glob('*.pdf'))
        
        if not pdf_files:
            print(f"❌ No se encontraron archivos PDF en: {self.folder_path}")
            return
        
        print(f"\n🔍 Encontrados {len(pdf_files)} archivos PDF")
        print("=" * 60)
        
        results = []
        
        for pdf_path in pdf_files:
            try:
                new_name = self.generate_filename(pdf_path)
                
                if new_name:
                    new_path = pdf_path.parent / new_name
                    
                    # Evita sobrescribir
                    counter = 1
                    while new_path.exists() and new_path != pdf_path:
                        name_without_ext = new_name.rsplit('.', 1)[0]
                        new_path = pdf_path.parent / f"{name_without_ext}_{counter}.pdf"
                        counter += 1
                    
                    results.append({
                        'original': pdf_path,
                        'new_name': new_path.name,
                        'new_path': new_path
                    })
                    
                    print(f"  ✅ Nuevo nombre: {new_path.name}")
                else:
                    print(f"  ⏭️  Mantiene nombre original")
                    
            except Exception as e:
                print(f"  ❌ Error: {e}")
        
        # Muestra resumen
        print("\n" + "=" * 60)
        print(f"📊 RESUMEN: {len(results)} archivos para renombrar")
        print("=" * 60)
        
        if not results:
            print("No hay archivos para renombrar.")
            return
        
        for result in results:
            print(f"\n{result['original'].name}")
            print(f"  → {result['new_name']}")
        
        # Confirma y renombra
        if dry_run:
            print("\n⚠️  MODO PRUEBA - No se renombraron archivos")
            print("Para renombrar, ejecuta con: --rename")
        else:
            print("\n⚠️  ¿Proceder con el renombrado? (s/n): ", end='')
            confirm = input().lower()
            
            if confirm == 's':
                for result in results:
                    try:
                        result['original'].rename(result['new_path'])
                        print(f"✅ Renombrado: {result['new_name']}")
                    except Exception as e:
                        print(f"❌ Error renombrando {result['original'].name}: {e}")
                
                print("\n✨ ¡Proceso completado!")
            else:
                print("❌ Operación cancelada")


def main():
    if len(sys.argv) < 2:
        print("Uso: python pdf_renamer.py <carpeta> [--rename]")
        print("\nEjemplo:")
        print("  python pdf_renamer.py ./documentos          # Modo prueba")
        print("  python pdf_renamer.py ./documentos --rename # Renombra archivos")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    rename_mode = '--rename' in sys.argv
    
    renamer = PDFRenamer(folder_path)
    renamer.rename_pdfs(dry_run=not rename_mode)


if __name__ == "__main__":
    main()
