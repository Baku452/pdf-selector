// File handling
let selectedFiles = [];

let uploadArea, fileInput, fileList, fileListItems, processBtn, clearBtn, results, resultsContent;

function initUpload() {
    uploadArea = document.getElementById('uploadArea');
    fileInput = document.getElementById('fileInput');
    fileList = document.getElementById('fileList');
    fileListItems = document.getElementById('fileListItems');
    processBtn = document.getElementById('processBtn');
    clearBtn = document.getElementById('clearBtn');
    results = document.getElementById('results');
    resultsContent = document.getElementById('resultsContent');

    // La zona de subida (clic, cambio, drag) se configura en el script inline del HTML
    if (!processBtn || !clearBtn) return;

    processBtn.addEventListener('click', onProcessClick);
    clearBtn.addEventListener('click', onClearClick);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUpload);
} else {
    initUpload();
}

function handleFiles(files) {
    // Filter only PDFs
    const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
        alert('Por favor, selecciona solo archivos PDF');
        return;
    }

    // Add to selected files
    selectedFiles = [...selectedFiles, ...pdfFiles];
    updateFileList();
    updateButtons();
}

function updateFileList() {
    if (selectedFiles.length === 0) {
        fileList.style.display = 'none';
        return;
    }

    fileList.style.display = 'block';
    fileListItems.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        `;
        fileListItems.appendChild(li);
    });
}

function updateButtons() {
    processBtn.disabled = selectedFiles.length === 0;
    clearBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function sanitizePart(value) {
    if (!value) return '';
    return String(value)
        .replace(/[<>:"/\\|?*]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

const EXAM_TYPE_ABBR = {
    'PREOCUPACIONAL': 'EMPO',
    'PERIODICO': 'EMOA',
    'POSTOCUPACIONAL': 'EMOR',
    'INGRESO': 'INGRESO',
    'EGRESO': 'EGRESO',
    'RETIRO': 'RETIRO',
};

function dateToShort(value) {
    if (!value) return '';
    const cleaned = String(value).trim().replace(/[./]/g, '-');
    const parts = cleaned.split('-');
    if (parts.length !== 3) return cleaned.replace(/-/g, '.');
    let [dd, mm, yy] = parts;
    if (yy.length === 4) yy = yy.slice(2);
    return `${dd}.${mm}.${yy}`;
}

function getSelectedFormat(cardEl) {
    if (cardEl) {
        const checked = cardEl.querySelector('input[name^="format_"]:checked');
        if (checked) return checked.value;
    }
    return 'standard';
}

// Global list of updatePreview callbacks so radio change can trigger them all
const _previewUpdaters = [];

function buildFinalFilename(fields, include, format, cardEl) {
    const dni = (fields.dni || '').trim();
    const nombre = (fields.nombre || '').trim().toUpperCase();
    const empresa = (fields.empresa || '').trim().toUpperCase();
    const tipoRaw = (fields.tipo_examen || '').trim().toUpperCase();
    const tipoAbbr = EXAM_TYPE_ABBR[tipoRaw] || tipoRaw;
    const fecha = dateToShort(fields.fecha);
    const fmt = format || getSelectedFormat(cardEl);

    if (fmt === 'standard') {
        // Standard: DNI-NOMBRE-EMPRESA-TIPO-CMESPINAR-FECHA.pdf
        const parts = [];
        if (include.dni && dni) parts.push(dni);
        if (include.nombre && nombre) parts.push(nombre);
        if (include.empresa && empresa) parts.push(empresa);
        if (include.tipo_examen && tipoAbbr) parts.push(tipoAbbr);
        parts.push('CMESPINAR');
        if (include.fecha && fecha) parts.push(fecha);
        const base = parts.filter(Boolean).join('-').replace(/[<>:"/\\|?*]/g, '');
        return base ? `${base}.pdf` : '';
    }

    // Hudbay: FECHA TIPO DNI NOMBRE-EMPRESA.pdf
    const parts = [];
    if (include.fecha && fecha) parts.push(fecha);
    if (include.tipo_examen && tipoAbbr) parts.push(tipoAbbr);
    if (include.dni && dni) parts.push(dni);

    let nameEmpresa = '';
    if (include.nombre && nombre) nameEmpresa = nombre;
    if (include.empresa && empresa) {
        nameEmpresa = nameEmpresa ? nameEmpresa + '-' + empresa : empresa;
    }
    if (nameEmpresa) parts.push(nameEmpresa);

    const base = parts.filter(Boolean).join(' ').replace(/[<>:"/\\|?*]/g, '');
    return base ? `${base}.pdf` : '';
}

function onProcessClick() {
    if (selectedFiles.length === 0) return;
    processBtn.disabled = true;
    if (processBtn.querySelector('.btn-text')) processBtn.querySelector('.btn-text').textContent = 'Procesando...';
    if (processBtn.querySelector('.btn-loader')) processBtn.querySelector('.btn-loader').style.display = 'inline-block';
    if (results) results.style.display = 'none';

    var formData = new FormData();
    selectedFiles.forEach(function (file) { formData.append('files', file); });

    fetch('/api/upload', { method: 'POST', body: formData })
        .then(function (r) {
            var contentType = r.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                if (r.status === 413) throw new Error('Archivo(s) demasiado grandes. Máximo 500MB.');
                throw new Error('Error del servidor (' + r.status + '). Intenta de nuevo.');
            }
            return r.json().then(function (data) { return { ok: r.ok, data: data }; });
        })
        .then(function (_) {
            var ok = _.ok, data = _.data;
            if (!ok) throw new Error(data.error || 'Error al procesar los archivos');
            displayResults(data.results, data.session_id);
        })
        .catch(function (err) { alert('Error: ' + (err.message || err)); })
        .finally(function () {
            processBtn.disabled = false;
            if (processBtn.querySelector('.btn-text')) processBtn.querySelector('.btn-text').textContent = 'Procesar PDFs';
            if (processBtn.querySelector('.btn-loader')) processBtn.querySelector('.btn-loader').style.display = 'none';
        });
}

function displayResults(resultsData, sessionId) {
    results.style.display = 'block';
    resultsContent.innerHTML = '';
    resultsContent.dataset.sessionId = sessionId || '';
    _previewUpdaters.length = 0;

    resultsData.forEach(result => {
        const div = document.createElement('div');
        div.className = 'result-item';
        if (result.file_index != null) div.dataset.fileIndex = String(result.file_index);

        // Hard error (exception)
        if (result.error) {
            div.innerHTML = `
                <div class="result-header">
                    <span class="error-icon">❌</span>
                    <span class="result-original">${result.original_name}</span>
                </div>
                <div class="result-error">
                    ${result.error}
                </div>
            `;
            resultsContent.appendChild(div);
            return;
        }

        const candidates = result.candidates || {};
        const defaults = result.defaults || {};
        const notes = Array.isArray(result.notes) ? result.notes : [];

        const icon = result.success ? '✅' : '⚠️';
        const iconClass = result.success ? 'success-icon' : 'warn-icon';

        div.innerHTML = `
            <div class="result-header">
                <span class="${iconClass}">${icon}</span>
                <span class="result-original">${result.original_name}</span>
            </div>

            ${notes.length ? `
                <div class="result-notes">
                    ${notes.map(n => `<div class="note-item">${n}</div>`).join('')}
                </div>
            ` : ''}

            <div class="builder-grid">
                ${renderBuilderHeader()}
                ${renderFieldRow('DNI', 'dni', candidates.dni || [], defaults.dni || '', { required: true })}
                ${renderFieldRow('Nombre', 'nombre', candidates.nombre || [], defaults.nombre || '', { required: false })}
                ${renderFieldRow('Empresa', 'empresa', candidates.empresa || [], defaults.empresa || '', { required: false })}
                ${renderFieldRow('Tipo de examen', 'tipo_examen', candidates.tipo_examen || [], defaults.tipo_examen || '', { required: false })}
                ${renderFieldRow('Fecha evaluación', 'fecha', candidates.fecha || [], defaults.fecha || '', { required: false })}
            </div>

            <div class="order-block">
                <div class="order-label">Campos incluidos</div>
                <div class="order-help">Activa o desactiva campos opcionales.</div>
                <div class="order-list" data-role="order-list">
                    ${(result.detected_format === 'hudbay'
                        ? [['fecha','Fecha'],['tipo_examen','Tipo de examen'],['dni','DNI'],['nombre','Nombre'],['empresa','Empresa']]
                        : [['dni','DNI'],['nombre','Nombre'],['empresa','Empresa'],['tipo_examen','Tipo de examen'],['fecha','Fecha']]
                    ).map(([f,l]) => renderOrderItem(f, l, true, f === 'dni')).join('')}
                </div>
            </div>

            <div class="format-selector">
                <span class="format-label">Formato:</span>
                <label class="format-option"><input type="radio" name="format_${result.file_index}" value="hudbay" ${(result.detected_format === 'hudbay') ? 'checked' : ''}> Hudbay</label>
                <label class="format-option"><input type="radio" name="format_${result.file_index}" value="standard" ${(result.detected_format !== 'hudbay') ? 'checked' : ''}> Estándar</label>
            </div>

            <div class="preview-block">
                <div class="preview-label">Nombre final</div>
                <div class="result-suggested" data-role="preview"></div>
                <div class="preview-actions">
                    <button class="btn btn-secondary btn-small" data-action="copy">Copiar</button>
                    ${result.file_index != null ? `<button class="btn btn-primary btn-small" data-action="download-one">Descargar PDF</button>` : ''}
                </div>
            </div>
        `;

        resultsContent.appendChild(div);

        // Wire interactions
        const include = {
            dni: true,
            nombre: true,
            empresa: true,
            tipo_examen: true,
            fecha: true,
        };

        const getFields = () => ({
            dni: div.querySelector('[data-field-input="dni"]').value,
            nombre: div.querySelector('[data-field-input="nombre"]').value,
            empresa: div.querySelector('[data-field-input="empresa"]').value,
            tipo_examen: div.querySelector('[data-field-input="tipo_examen"]').value,
            fecha: div.querySelector('[data-field-input="fecha"]').value,
        });

        const getOrder = () => {
            const list = div.querySelector('[data-role="order-list"]');
            if (!list) return ['fecha', 'tipo_examen', 'dni', 'nombre', 'empresa'];
            return Array.from(list.children)
                .map(el => el.getAttribute('data-order-field'))
                .filter(Boolean);
        };

        const syncIncludeFromUI = () => {
            div.querySelectorAll('[data-include-field]').forEach(chk => {
                const field = chk.getAttribute('data-include-field');
                include[field] = chk.checked;
            });
            // fijo
            include.dni = true;
        };

        const updatePreview = () => {
            const previewEl = div.querySelector('[data-role="preview"]');
            const fields = getFields();
            syncIncludeFromUI();
            const name = buildFinalFilename(fields, include, null, div);
            previewEl.textContent = name || '(completa los campos para generar el nombre)';
        };
        _previewUpdaters.push(updatePreview);

        const HUDBAY_ORDER = ['fecha', 'tipo_examen', 'dni', 'nombre', 'empresa'];
        const STANDARD_ORDER = ['dni', 'nombre', 'empresa', 'tipo_examen', 'fecha'];

        const reorderFields = (fmt) => {
            const list = div.querySelector('[data-role="order-list"]');
            if (!list) return;
            const order = fmt === 'hudbay' ? HUDBAY_ORDER : STANDARD_ORDER;
            order.forEach(field => {
                const item = list.querySelector(`[data-order-field="${field}"]`);
                if (item) list.appendChild(item);
            });
        };

        // format radio -> reorder fields and update preview
        div.querySelectorAll('input[name^="format_"]').forEach(radio => {
            radio.addEventListener('change', () => {
                reorderFields(radio.value);
                updatePreview();
            });
        });

        // select -> input
        div.querySelectorAll('[data-field-select]').forEach(sel => {
            sel.addEventListener('change', () => {
                const field = sel.getAttribute('data-field-select');
                const input = div.querySelector(`[data-field-input="${field}"]`);
                if (input) input.value = sel.value || '';
                updatePreview();
            });
        });

        // input -> preview
        div.querySelectorAll('[data-field-input]').forEach(inp => {
            inp.addEventListener('input', updatePreview);
        });

        // include checkboxes (en lista de orden)
        div.querySelectorAll('[data-include-field]').forEach(chk => {
            chk.addEventListener('change', updatePreview);
        });

        // drag & drop order (per PDF)
        enableDragSort(div.querySelector('[data-role="order-list"]'), updatePreview);

        // copy
        const copyBtn = div.querySelector('[data-action="copy"]');
        copyBtn.addEventListener('click', async () => {
            const preview = div.querySelector('[data-role="preview"]').textContent || '';
            if (!preview || preview.startsWith('(')) return;
            try {
                await navigator.clipboard.writeText(preview);
                copyBtn.textContent = 'Copiado';
                setTimeout(() => (copyBtn.textContent = 'Copiar'), 1200);
            } catch {
                // fallback
                prompt('Copia el nombre:', preview);
            }
        });

        // download this PDF with chosen name
        const downloadOneBtn = div.querySelector('[data-action="download-one"]');
        if (downloadOneBtn) {
            downloadOneBtn.addEventListener('click', async () => {
                const preview = div.querySelector('[data-role="preview"]').textContent || '';
                if (!preview || preview.startsWith('(')) return;
                const sid = resultsContent.dataset.sessionId;
                const idx = div.dataset.fileIndex;
                if (!sid || idx == null) return;

                // Use pywebview native save dialog if available (desktop mode)
                if (window.pywebview && window.pywebview.api) {
                    downloadOneBtn.disabled = true;
                    downloadOneBtn.textContent = 'Guardando...';
                    try {
                        const result = await window.pywebview.api.save_file(sid, parseInt(idx, 10), preview);
                        if (result.error) {
                            alert('Error: ' + result.error);
                        } else if (result.ok) {
                            downloadOneBtn.textContent = 'Guardado!';
                            setTimeout(() => { downloadOneBtn.textContent = 'Descargar PDF'; }, 1500);
                        }
                    } catch (e) {
                        alert('Error: ' + (e.message || e));
                    } finally {
                        downloadOneBtn.disabled = false;
                        if (downloadOneBtn.textContent === 'Guardando...') downloadOneBtn.textContent = 'Descargar PDF';
                    }
                    return;
                }

                // Fallback: browser download
                const url = `/api/download/${sid}/${idx}?filename=${encodeURIComponent(preview)}`;
                const a = document.createElement('a');
                a.href = url;
                a.download = preview;
                a.rel = 'noopener';
                a.click();
            });
        }

        updatePreview();
    });

    // "Descargar todos (ZIP)" button
    const zipSessionId = resultsContent.dataset.sessionId;
    const downloadables = Array.from(resultsContent.querySelectorAll('[data-file-index]'));
    if (zipSessionId && downloadables.length > 0) {
        const zipWrap = document.createElement('div');
        zipWrap.className = 'download-all-wrap';
        zipWrap.innerHTML = `
            <button class="btn btn-primary" id="downloadAllZip" type="button">Descargar todos (ZIP)</button>
        `;
        resultsContent.appendChild(zipWrap);

        document.getElementById('downloadAllZip').addEventListener('click', async () => {
            const zipBtn = document.getElementById('downloadAllZip');
            const files = [];
            downloadables.forEach(card => {
                const previewEl = card.querySelector('[data-role="preview"]');
                const name = (previewEl && previewEl.textContent) ? previewEl.textContent.trim() : '';
                if (name && !name.startsWith('(')) {
                    files.push({ index: parseInt(card.dataset.fileIndex, 10), filename: name });
                }
            });
            if (files.length === 0) {
                alert('No hay nombres válidos para descargar. Completa al menos un nombre.');
                return;
            }

            // Use pywebview native save dialog if available (desktop mode)
            if (window.pywebview && window.pywebview.api) {
                zipBtn.disabled = true;
                zipBtn.textContent = 'Guardando...';
                try {
                    const result = await window.pywebview.api.save_zip(zipSessionId, JSON.stringify(files));
                    if (result.error) {
                        alert('Error: ' + result.error);
                    } else if (result.ok) {
                        zipBtn.textContent = 'Guardado!';
                        setTimeout(() => { zipBtn.textContent = 'Descargar todos (ZIP)'; }, 1500);
                    }
                } catch (e) {
                    alert('Error: ' + (e.message || e));
                } finally {
                    zipBtn.disabled = false;
                    if (zipBtn.textContent === 'Guardando...') zipBtn.textContent = 'Descargar todos (ZIP)';
                }
                return;
            }

            // Fallback: browser download
            try {
                const res = await fetch('/api/download-zip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: zipSessionId, files }),
                });
                if (!res.ok) throw new Error('Error al generar el ZIP');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'PDFNameSetter_descargas.zip';
                a.rel = 'noopener';
                a.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('Error: ' + (e.message || e));
            }
        });
    }

    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function examTypeDisplayLabel(value) {
    const abbr = EXAM_TYPE_ABBR[value];
    if (abbr && abbr !== value) return `${value} (${abbr})`;
    return value;
}

function renderFieldRow(label, field, options, defaultValue, { required }) {
    const safeOptions = Array.isArray(options) ? options : [];
    const optHtml = safeOptions.length
        ? safeOptions.map(v => {
            const display = field === 'tipo_examen' ? examTypeDisplayLabel(v) : v;
            const sel = (v === defaultValue) ? ' selected' : '';
            return `<option value="${escapeHtml(v)}"${sel}>${escapeHtml(display)}</option>`;
        }).join('')
        : `<option value="">(no encontrado)</option>`;

    return `
        <div class="field-row">
            <div class="field-label">
                <div class="field-title">
                    <span>${escapeHtml(label)}</span>
                    ${required ? `<span class="pill pill-required">requerido</span>` : `<span class="pill pill-optional">opcional</span>`}
                </div>
            </div>
            <select class="field-select" data-field-select="${field}">
                <option value="">(seleccionar)</option>
                ${optHtml}
            </select>
            <input class="field-input" data-field-input="${field}" type="text" value="${escapeHtml(defaultValue || '')}" placeholder="${required ? 'requerido' : 'opcional'}" />
        </div>
    `;
}

function renderBuilderHeader() {
    return `
        <div class="builder-header">
            <div>Campo</div>
            <div class="muted">Valor Extraído</div>
            <div class="muted">Editable</div>
        </div>
    `;
}

function renderOrderItem(field, label, checked, locked) {
    const isLocked = Boolean(locked);
    const isChecked = Boolean(checked);
    const disabled = isLocked ? 'disabled' : '';
    const forced = field === 'dni';
    const checkbox = forced
        ? `<input type="checkbox" checked disabled aria-label="Incluir ${escapeHtml(label)}" />`
        : `<input type="checkbox" ${isChecked ? 'checked' : ''} ${disabled} data-include-field="${field}" aria-label="Incluir ${escapeHtml(label)}" />`;

    return `
        <div class="order-item" data-order-field="${field}" draggable="true">
            <div class="order-left">
                <span class="order-handle" aria-hidden="true">⠿</span>
                ${checkbox}
                <span class="order-text">${escapeHtml(label)}</span>
            </div>
        </div>
    `;
}

function enableDragSort(listEl, onChange) {
    if (!listEl) return;
    let dragging = null;

    const items = () => Array.from(listEl.querySelectorAll('[data-order-field]'));
    const clearTargets = () => items().forEach(i => i.classList.remove('drop-target'));

    listEl.addEventListener('dragstart', (e) => {
        const item = e.target.closest('[data-order-field]');
        if (!item) return;
        dragging = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try {
            e.dataTransfer.setData('text/plain', item.getAttribute('data-order-field') || '');
        } catch {}
    });

    listEl.addEventListener('dragend', () => {
        if (dragging) dragging.classList.remove('dragging');
        dragging = null;
        clearTargets();
        if (typeof onChange === 'function') onChange();
    });

    listEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragging) return;

        const afterEl = getDragAfterElement(listEl, e.clientY, dragging);
        if (afterEl == null) {
            listEl.appendChild(dragging);
        } else {
            listEl.insertBefore(dragging, afterEl);
        }

        clearTargets();
        const over = e.target.closest('[data-order-field]');
        if (over && over !== dragging) over.classList.add('drop-target');
    });

    listEl.addEventListener('drop', (e) => {
        e.preventDefault();
        clearTargets();
        if (typeof onChange === 'function') onChange();
    });

    function getDragAfterElement(container, y, draggingEl) {
        const draggableElements = [...container.querySelectorAll('[data-order-field]:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Clear button
function onClearClick() {
    selectedFiles = [];
    if (fileInput) fileInput.value = '';
    updateFileList();
    updateButtons();
    if (results) results.style.display = 'none';
}
