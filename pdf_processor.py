#!/usr/bin/env python3
"""
Shared PDF Processing Logic
Core functionality for extracting information from PDFs
"""

import re
import pytesseract
from pdf2image import convert_from_path
import fitz  # pymupdf


class PDFProcessor:
    """Core PDF processing functionality shared between CLI and web app"""
    
    def extract_text_from_pdf(self, pdf_path, use_ocr=True, verbose=False):
        """Extrae texto de PDF (digital o escaneado)"""
        text = ""
        
        # Intenta extraer texto digital primero
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                text += page.get_text()
            doc.close()
            
            # Si hay suficiente texto, no necesita OCR
            if len(text.strip()) > 50:
                return text
        except Exception as e:
            if verbose:
                print(f"  ⚠️  Error extrayendo texto digital: {e}")
        
        # Si no hay texto o es muy poco, usa OCR
        if use_ocr:
            if verbose:
                print(f"  🔍 Aplicando OCR (documento escaneado)...")
            try:
                images = convert_from_path(pdf_path, first_page=1, last_page=3)  # Solo primeras 3 páginas
                for image in images:
                    text += pytesseract.image_to_string(image, lang='spa+eng')
            except Exception as e:
                if verbose:
                    print(f"  ❌ Error en OCR: {e}")
                return ""
        
        return text
    
    def extract_dates(self, text):
        """Extrae fechas del texto"""
        date_patterns = [
            r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # 31/12/2024 o 31-12-2024
            r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',    # 2024/12/31
            r'\d{1,2}\.\d{1,2}\.\d{2,4}',      # 31.12.2025 o 31.12.25
            r'\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}',
        ]
        
        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)
        
        # Prefiere fechas más recientes o las que aparecen primero
        return dates[0] if dates else None
    
    def extract_numbers(self, text):
        """Extrae números de referencia, factura, DNI, etc."""
        patterns = [
            r'DNI\s*[:\-]?\s*(\d{8})',  # DNI peruano (8 dígitos)
            r'DNI\s*[:\-]?\s*(\d+)',    # DNI general
            r'(?:N°|Nº|No\.|Número|Number|#)\s*[:\-]?\s*(\d+)',
            r'(?:Factura|Invoice|Boleta|Recibo|Receipt)\s*[:\-]?\s*[A-Z]?\d+',
            r'(?:RUC|RFC|NIT|CI)\s*[:\-]?\s*\d+',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                # Si capturó un grupo, usa ese; si no, usa todo el match
                result = match.group(1) if match.lastindex else match.group(0)
                return result.replace(' ', '_')
        
        return None
    
    def extract_entity_names(self, text):
        """Extrae nombres de empresas o personas"""
        lines = text.split('\n')[:30]  # Primeras 30 líneas
        
        # Patrones para nombres de personas (apellidos y nombres)
        person_patterns = [
            r'(?:APELLIDOS?\s+Y\s+NOMBRES?|NOMBRES?\s+Y\s+APELLIDOS?|NOMBRE|NAME)[:\s]+([A-ZÁÉÍÓÚÑ\s]{10,60})',
            r'([A-ZÁÉÍÓÚÑ]{2,20}\s+[A-ZÁÉÍÓÚÑ]{2,20}\s+[A-ZÁÉÍÓÚÑ]{2,20})',  # 3 palabras en mayúsculas
        ]
        
        # Busca nombres de personas primero
        for pattern in person_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip() if match.lastindex else match.group(0).strip()
                # Limpia y valida
                clean_name = re.sub(r'[^\w\sÁÉÍÓÚÑáéíóúñ]', '', name)
                if 10 < len(clean_name) < 60 and len(clean_name.split()) >= 2:
                    return clean_name.strip()
        
        # Si no encuentra persona, busca empresas
        for line in lines:
            line = line.strip()
            # Busca líneas con palabras en mayúsculas (empresas)
            if 5 < len(line) < 80 and any(c.isupper() for c in line):
                # Evita líneas que son solo números o fechas
                if re.search(r'[A-ZÁÉÍÓÚÑ]{3,}', line):
                    clean_name = re.sub(r'[^\w\sÁÉÍÓÚÑáéíóúñ&]', '', line)
                    if clean_name and 5 < len(clean_name) < 80:
                        # Limita a palabras razonables
                        words = clean_name.split()
                        if 1 <= len(words) <= 6:
                            return ' '.join(words).strip()
        
        return None
    
    def detect_document_type(self, text):
        """Detecta el tipo de documento"""
        text_lower = text.lower()
        
        doc_types = {
            'emoa': ['emoa', 'evaluación médica ocupacional', 'evaluacion medica ocupacional', 'examen médico ocupacional'],
            'factura': ['factura', 'invoice', 'bill'],
            'recibo': ['recibo', 'receipt'],
            'contrato': ['contrato', 'contract', 'acuerdo'],
            'certificado': ['certificado', 'certificate', 'constancia'],
            'boleta': ['boleta', 'ticket'],
            'orden': ['orden de compra', 'purchase order'],
            'reporte': ['reporte', 'report', 'informe'],
            'licencia': ['licencia de conducir', 'licencia'],
        }
        
        for doc_type, keywords in doc_types.items():
            if any(keyword in text_lower for keyword in keywords):
                return doc_type.upper() if doc_type == 'emoa' else doc_type.capitalize()
        
        return None
    
    def extract_exam_type(self, text):
        """Extrae tipo de examen médico (PERIODICO, INGRESO, etc.)"""
        text_upper = text.upper()
        exam_types = ['PERIODICO', 'INGRESO', 'EGRESO', 'RETIRO', 'PREOCUPACIONAL', 'POSTOCUPACIONAL']
        
        for exam_type in exam_types:
            if exam_type in text_upper:
                return exam_type
        
        return None
    
    def extract_from_filename(self, filename):
        """Extrae información del nombre del archivo como fallback"""
        # Ejemplo: "31.12.25 EMOA 77206347 GONZA URQUIZO JULIO CESAR-CONSORCIO BYAS CHILLOROYA MECANICA & REVESTIMIENTO.pdf"
        parts = {}
        name_without_ext = filename.rsplit('.pdf', 1)[0].rsplit('.PDF', 1)[0]
        
        # Extrae fecha (DD.MM.YY o DD-MM-YY)
        date_match = re.search(r'(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})', name_without_ext)
        if date_match:
            parts['date'] = date_match.group(1)
        
        # Extrae DNI (8 dígitos seguidos)
        dni_match = re.search(r'(\d{8})', name_without_ext)
        if dni_match:
            parts['dni'] = dni_match.group(1)
        
        # Busca EMOA
        if 'emoa' in name_without_ext.lower():
            parts['doc_type'] = 'EMOA'
        
        # Busca tipo de examen
        exam_types = ['PERIODICO', 'INGRESO', 'EGRESO', 'RETIRO']
        for exam_type in exam_types:
            if exam_type.lower() in name_without_ext.lower():
                parts['exam_type'] = exam_type
                break
        
        # Extrae nombre de persona (después de DNI, antes de guion)
        # Formato: "31.12.25 EMOA 77206347 GONZA URQUIZO JULIO CESAR-CONSORCIO..."
        # Busca: número de DNI seguido de palabras en mayúsculas hasta un guion
        name_patterns = [
            r'\d{8}\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{8,50}?)(?:\s*-)',  # DNI seguido de nombre hasta guion
            r'(?:DNI|dni|ID|id)[:\s]*\d+\s+([A-ZÁÉÍÓÚÑ\s]{10,50}?)(?:-|CONSORCIO|EMPRESA|COMPANY)',  # Patrón alternativo
        ]
        
        for pattern in name_patterns:
            name_match = re.search(pattern, name_without_ext, re.IGNORECASE)
            if name_match:
                person_name = name_match.group(1).strip()
                # Valida que sea un nombre (al menos 2 palabras, no solo números)
                if len(person_name.split()) >= 2 and not person_name.replace(' ', '').isdigit():
                    parts['person_name'] = person_name
                    break
        
        # Extrae empresa (después del guion)
        if '-' in name_without_ext:
            company_part = name_without_ext.split('-', 1)[1]
            # Limpia y toma las primeras palabras (máximo 4)
            company_clean = re.sub(r'[&]', 'Y', company_part)
            # Elimina "MECANICA" y "REVESTIMIENTO" si están al final, o toma las primeras palabras
            company_words = company_clean.split()
            # Si hay muchas palabras, toma las primeras 3-4 más relevantes
            if len(company_words) > 4:
                # Prioriza CONSORCIO, BYAS, CHILLOROYA
                important_words = [w for w in company_words[:6] if w.upper() not in ['MECANICA', 'REVESTIMIENTO', 'Y']]
                company_words = important_words[:4] if important_words else company_words[:3]
            else:
                company_words = company_words[:4]
            
            if company_words:
                parts['company'] = ' '.join(company_words)
        
        return parts
    
    def generate_filename_parts(self, pdf_path, verbose=False, original_filename=None):
        """Extrae información y genera partes del nombre de archivo"""
        # Extrae texto del PDF
        text = self.extract_text_from_pdf(pdf_path, verbose=verbose)
        
        # Si no hay texto suficiente, intenta extraer del nombre del archivo
        filename_data = {}
        if original_filename:
            filename_data = self.extract_from_filename(original_filename)
            if verbose:
                print(f"  📁 Información extraída del nombre: {filename_data}")
        
        # Si no hay texto del PDF, usa solo el nombre del archivo
        if not text or len(text.strip()) < 10:
            if filename_data:
                # Construye nombre desde el nombre del archivo
                parts = []
                metadata = {}
                
                # Orden específico: DNI, NOMBRE, EMPRESA, TIPO_EXAMEN, CMESPINAR, FECHA
                
                # 1. DNI (requerido)
                if filename_data.get('dni'):
                    parts.append(filename_data['dni'])
                    metadata['dni'] = filename_data['dni']
                else:
                    # Sin DNI no podemos generar nombre
                    if verbose:
                        print("  ⚠️  DNI no encontrado en nombre del archivo")
                    return None, None
                
                # 2. NOMBRE
                if filename_data.get('person_name'):
                    name_clean = '_'.join(filename_data['person_name'].split()[:4])
                    name_clean = re.sub(r'[<>:"/\\|?*&]', '', name_clean)
                    parts.append(name_clean)
                    metadata['nombre'] = filename_data['person_name']
                
                # 3. EMPRESA
                if filename_data.get('company'):
                    company_clean = '_'.join(filename_data['company'].split()[:4])
                    company_clean = re.sub(r'[<>:"/\\|?*&]', '', company_clean)
                    parts.append(company_clean)
                    metadata['empresa'] = filename_data['company']
                
                # 4. TIPO DE EXAMEN
                if filename_data.get('exam_type'):
                    parts.append(filename_data['exam_type'])
                    metadata['tipo_examen'] = filename_data['exam_type']
                
                # 5. CMESPINAR (constante)
                parts.append('CMESPINAR')
                metadata['centro'] = 'CMESPINAR'
                
                # 6. FECHA DE EVALUACION
                if filename_data.get('date'):
                    date_clean = filename_data['date'].replace('.', '-').replace('/', '-')
                    parts.append(date_clean)
                    metadata['fecha'] = filename_data['date']
                
                if parts:
                    new_name = '_'.join(parts)
                    new_name = re.sub(r'[<>:"/\\|?*]', '', new_name)
                    new_name = re.sub(r'\s+', '_', new_name)
                    new_name = re.sub(r'_+', '_', new_name)
                    new_name = new_name.strip('_')
                    return new_name + '.pdf', metadata
            
            # Si tampoco hay datos del nombre, retorna None
            if verbose:
                print(f"  ⚠️  Texto extraído: {len(text) if text else 0} caracteres")
            return None, None
        
        # Extrae información del texto del PDF
        date = self.extract_dates(text)
        number = self.extract_numbers(text)
        entity = self.extract_entity_names(text)
        doc_type = self.detect_document_type(text)
        exam_type = self.extract_exam_type(text)
        
        # Si no se encontró información en el texto, usa datos del nombre del archivo como fallback
        if not date and filename_data.get('date'):
            date = filename_data['date']
        if not number and filename_data.get('dni'):
            number = filename_data['dni']
        if not doc_type and filename_data.get('doc_type'):
            doc_type = filename_data['doc_type']
        if not exam_type and filename_data.get('exam_type'):
            exam_type = filename_data['exam_type']
        if not entity:
            if filename_data.get('person_name'):
                entity = filename_data['person_name']
            elif filename_data.get('company'):
                entity = filename_data['company']
        
        # Construye las partes en el orden específico requerido:
        # 1. DNI
        # 2. NOMBRE
        # 3. EMPRESA
        # 4. TIPO DE EXAMEN
        # 5. CMESPINAR (constante)
        # 6. FECHA DE EVALUACION
        parts = []
        metadata = {}
        
        # 1. DNI
        dni_value = None
        if number:
            # Si es DNI (8 dígitos) o contiene DNI en el texto
            if 'DNI' in text.upper() or (number and len(number) == 8):
                dni_value = number
            elif number:
                dni_value = number
        
        # También verifica en filename_data
        if not dni_value and filename_data.get('dni'):
            dni_value = filename_data['dni']
        
        if dni_value:
            parts.append(dni_value)
            metadata['dni'] = dni_value
            if verbose:
                print(f"  🔢 DNI: {dni_value}")
        else:
            # Si no hay DNI, no podemos generar el nombre
            if verbose:
                print("  ⚠️  DNI no encontrado - requerido para generar nombre")
            return None, None
        
        # 2. NOMBRE (persona)
        person_name = None
        if entity:
            # Verifica si es un nombre de persona (típicamente 3-4 palabras en mayúsculas)
            entity_words = entity.split()
            if len(entity_words) >= 2:
                # Si tiene 2-4 palabras y son mayúsculas, probablemente es nombre de persona
                if all(word[0].isupper() if word else False for word in entity_words[:3]):
                    person_name = entity
        
        # También verifica en filename_data
        if not person_name and filename_data.get('person_name'):
            person_name = filename_data['person_name']
        
        if person_name:
            # Limpia y normaliza el nombre
            name_clean = '_'.join(person_name.split()[:4])  # Máximo 4 palabras
            name_clean = re.sub(r'[<>:"/\\|?*&]', '', name_clean)
            parts.append(name_clean)
            metadata['nombre'] = person_name
            if verbose:
                print(f"  👤 Nombre: {person_name}")
        else:
            # Nombre es opcional pero recomendado
            if verbose:
                print("  ⚠️  Nombre no encontrado")
        
        # 3. EMPRESA
        company_name = None
        if filename_data.get('company'):
            company_name = filename_data['company']
        elif entity and not person_name:
            # Si entity no es nombre de persona, podría ser empresa
            company_name = entity
        
        if company_name:
            # Limpia y normaliza la empresa
            company_clean = '_'.join(company_name.split()[:4])  # Máximo 4 palabras
            company_clean = re.sub(r'[<>:"/\\|?*&]', '', company_clean)
            parts.append(company_clean)
            metadata['empresa'] = company_name
            if verbose:
                print(f"  🏢 Empresa: {company_name}")
        else:
            # Empresa es opcional
            if verbose:
                print("  ⚠️  Empresa no encontrada")
        
        # 4. TIPO DE EXAMEN
        exam_type_value = None
        if exam_type:
            exam_type_value = exam_type
        elif filename_data.get('exam_type'):
            exam_type_value = filename_data['exam_type']
        
        if exam_type_value:
            parts.append(exam_type_value)
            metadata['tipo_examen'] = exam_type_value
            if verbose:
                print(f"  🏥 Tipo de examen: {exam_type_value}")
        else:
            # Tipo de examen es opcional
            if verbose:
                print("  ⚠️  Tipo de examen no encontrado")
        
        # 5. CMESPINAR (constante)
        parts.append('CMESPINAR')
        metadata['centro'] = 'CMESPINAR'
        if verbose:
            print(f"  🏥 Centro: CMESPINAR")
        
        # 6. FECHA DE EVALUACION
        if date:
            try:
                # Normaliza fecha: convierte 31.12.25 a 31-12-25, o 31/12/2025 a 31-12-2025
                date_clean = re.sub(r'[^\d./-]', '', date)
                # Si tiene formato DD.MM.YY, convierte a DD-MM-YY
                if '.' in date_clean:
                    date_clean = date_clean.replace('.', '-')
                else:
                    date_clean = date_clean.replace('/', '-')
                parts.append(date_clean)
                metadata['fecha'] = date
                if verbose:
                    print(f"  📅 Fecha: {date}")
            except:
                pass
        elif filename_data.get('date'):
            date_clean = filename_data['date'].replace('.', '-').replace('/', '-')
            parts.append(date_clean)
            metadata['fecha'] = filename_data['date']
            if verbose:
                print(f"  📅 Fecha (del nombre): {filename_data['date']}")
        
        # Valida que al menos tengamos DNI y FECHA (mínimos requeridos)
        if not parts or len(parts) < 2:
            if verbose:
                print("  ⚠️  Información insuficiente para generar nombre")
            return None, None
        
        # Une las partes y limpia caracteres no válidos
        new_name = '_'.join(parts)
        new_name = re.sub(r'[<>:"/\\|?*]', '', new_name)
        new_name = re.sub(r'\s+', '_', new_name)
        new_name = re.sub(r'_+', '_', new_name)
        new_name = new_name.strip('_')  # Elimina guiones al inicio/final
        
        return new_name + '.pdf', metadata
