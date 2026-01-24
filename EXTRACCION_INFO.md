# Cómo se Extraen los Valores del PDF

## Proceso General

El sistema extrae información en **2 pasos**:

1. **Extracción del contenido del PDF** (texto digital o OCR)
2. **Fallback al nombre del archivo** (si no se puede extraer del contenido)

---

## 1. Extracción de Texto del PDF

### Método: `extract_text_from_pdf()`

**Paso 1: Extracción de texto digital**
- Usa `PyMuPDF` (fitz) para extraer texto directamente del PDF
- Si encuentra más de 50 caracteres, usa ese texto
- Si no hay suficiente texto, pasa al Paso 2

**Paso 2: OCR (Reconocimiento Óptico de Caracteres)**
- Convierte las primeras 3 páginas del PDF a imágenes
- Usa `Tesseract OCR` con idiomas español + inglés
- Extrae texto de las imágenes escaneadas

---

## 2. Extracción de Valores Específicos

Una vez que tenemos el texto, se extraen los valores usando **expresiones regulares (regex)**:

### 🔢 **DNI** - `extract_numbers()`

**Patrones que busca:**
```python
- "DNI: 77206347" o "DNI 77206347"
- Números de 8 dígitos (DNI peruano)
- Cualquier número después de "DNI"
```

**Ejemplo de extracción:**
```
Texto: "DNI: 77206347"
Resultado: "77206347"
```

---

### 👤 **NOMBRE** - `extract_entity_names()`

**Patrones que busca:**
```python
1. "APELLIDOS Y NOMBRES: GONZA URQUIZO JULIO CESAR"
2. "NOMBRE: GONZA URQUIZO JULIO CESAR"
3. Palabras en mayúsculas (3-4 palabras juntas)
```

**Ejemplo de extracción:**
```
Texto: "APELLIDOS Y NOMBRES: GONZA URQUIZO JULIO CESAR"
Resultado: "GONZA URQUIZO JULIO CESAR"
```

---

### 🏢 **EMPRESA** - `extract_entity_names()`

**Cómo lo detecta:**
- Busca líneas con palabras en mayúsculas (5-80 caracteres)
- Busca después de un guion "-" en el texto
- Limita a 4-6 palabras

**Ejemplo de extracción:**
```
Texto: "EMPRESA: CONSORCIO BYAS CHILLOROYA MECANICA & REVESTIMIENTO"
Resultado: "CONSORCIO BYAS CHILLOROYA"
```

---

### 🏥 **TIPO DE EXAMEN** - `extract_exam_type()`

**Valores que busca:**
```python
- "PERIODICO"
- "INGRESO"
- "EGRESO"
- "RETIRO"
- "PREOCUPACIONAL"
- "POSTOCUPACIONAL"
```

**Ejemplo de extracción:**
```
Texto: "TIPO DE EXAMEN: PERIODICO"
Resultado: "PERIODICO"
```

---

### 📅 **FECHA DE EVALUACION** - `extract_dates()`

**Formatos que reconoce:**
```python
- "31/12/2025"
- "31-12-2025"
- "31.12.25"
- "31 de diciembre de 2025"
```

**Ejemplo de extracción:**
```
Texto: "FECHA: 31/12/2025"
Resultado: "31-12-2025" (normalizado)
```

---

## 3. Fallback: Extracción del Nombre del Archivo

Si el PDF no tiene texto extraíble, el sistema usa el **nombre del archivo** como fuente de información.

### Método: `extract_from_filename()`

**Ejemplo de nombre de archivo:**
```
"31.12.25 EMOA 77206347 GONZA URQUIZO JULIO CESAR-CONSORCIO BYAS CHILLOROYA MECANICA & REVESTIMIENTO.pdf"
```

**Extrae:**
1. **Fecha**: `31.12.25` (patrón: `\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}`)
2. **EMOA**: Detecta la palabra "EMOA"
3. **DNI**: `77206347` (8 dígitos consecutivos)
4. **Nombre**: `GONZA URQUIZO JULIO CESAR` (después del DNI, antes del guion)
5. **Empresa**: `CONSORCIO BYAS CHILLOROYA` (después del guion)
6. **Tipo de examen**: Busca "PERIODICO", "INGRESO", etc.

---

## 4. Generación del Nombre Final

Una vez extraídos todos los valores, se construye el nombre en este orden:

```
DNI_NOMBRE_EMPRESA_TIPO_EXAMEN_CMESPINAR_FECHA.pdf
```

**Ejemplo:**
```
77206347_GONZA_URQUIZO_JULIO_CESAR_CONSORCIO_BYAS_CHILLOROYA_PERIODICO_CMESPINAR_31-12-25.pdf
```

---

## Limitaciones Actuales

1. **DNI es obligatorio**: Si no se encuentra DNI, no se genera el nombre
2. **OCR puede ser lento**: Para PDFs escaneados grandes
3. **Patrones específicos**: Los regex pueden no capturar todos los formatos posibles
4. **Idioma**: Optimizado para español, pero también busca en inglés

---

## Mejoras Posibles

Si necesitas mejorar la extracción, podemos:
- Agregar más patrones regex para diferentes formatos
- Mejorar la detección de nombres y empresas
- Agregar campos adicionales si es necesario
- Optimizar el OCR para documentos específicos
