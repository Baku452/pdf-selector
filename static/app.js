// File handling
let selectedFiles = [];

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileListItems = document.getElementById('fileListItems');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const resultsContent = document.getElementById('resultsContent');

// Click to select files
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf'
    );
    handleFiles(files);
});

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

function normalizeDate(value) {
    if (!value) return '';
    return String(value).trim().replace(/[./]/g, '-').replace(/-+/g, '-');
}

function buildFinalFilename(fields, include, order) {
    const dni = sanitizePart(fields.dni);
    const nombre = sanitizePart(fields.nombre);
    const empresa = sanitizePart(fields.empresa);
    const tipo = sanitizePart((fields.tipo_examen || '').toUpperCase());
    const fecha = sanitizePart(normalizeDate(fields.fecha));

    const values = { dni, nombre, empresa, tipo_examen: tipo, fecha };
    const parts = [];
    const ord = Array.isArray(order) && order.length
        ? order
        : ['dni', 'nombre', 'empresa', 'tipo_examen', 'centro', 'fecha'];

    for (const key of ord) {
        if (key === 'centro') {
            parts.push('CMESPINAR');
            continue;
        }
        if (!include[key]) continue;
        const v = values[key];
        if (v) parts.push(v);
    }

    const base = parts.filter(Boolean).join('_').replace(/_+/g, '_');
    return base ? `${base}.pdf` : '';
}

// Process button
processBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    // Show loading state
    processBtn.disabled = true;
    processBtn.querySelector('.btn-text').textContent = 'Procesando...';
    processBtn.querySelector('.btn-loader').style.display = 'inline-block';
    results.style.display = 'none';

    try {
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al procesar los archivos');
        }

        displayResults(data.results);

    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Reset button state
        processBtn.disabled = false;
        processBtn.querySelector('.btn-text').textContent = 'Procesar PDFs';
        processBtn.querySelector('.btn-loader').style.display = 'none';
    }
});

function displayResults(resultsData) {
    results.style.display = 'block';
    resultsContent.innerHTML = '';

    resultsData.forEach(result => {
        const div = document.createElement('div');
        div.className = 'result-item';

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
                <div class="order-label">Orden del nombre</div>
                <div class="order-help">Arrastra y suelta para reordenar (por PDF). Puedes desactivar campos opcionales.</div>
                <div class="order-list" data-role="order-list">
                    ${renderOrderItem('dni', 'DNI', true, true)}
                    ${renderOrderItem('nombre', 'Nombre', true, false)}
                    ${renderOrderItem('empresa', 'Empresa', true, false)}
                    ${renderOrderItem('tipo_examen', 'Tipo de examen', true, false)}
                    ${renderOrderItem('centro', 'CMESPINAR', true, true)}
                    ${renderOrderItem('fecha', 'Fecha', true, false)}
                </div>
            </div>

            <div class="preview-block">
                <div class="preview-label">Nombre final</div>
                <div class="result-suggested" data-role="preview"></div>
                <div class="preview-actions">
                    <button class="btn btn-secondary btn-small" data-action="copy">Copiar</button>
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
            centro: true,
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
            if (!list) return ['dni', 'nombre', 'empresa', 'tipo_examen', 'centro', 'fecha'];
            return Array.from(list.children)
                .map(el => el.getAttribute('data-order-field'))
                .filter(Boolean);
        };

        const syncIncludeFromUI = () => {
            div.querySelectorAll('[data-include-field]').forEach(chk => {
                const field = chk.getAttribute('data-include-field');
                include[field] = chk.checked;
            });
            // fijos
            include.dni = true;
            include.centro = true;
        };

        const updatePreview = () => {
            const previewEl = div.querySelector('[data-role="preview"]');
            const fields = getFields();
            syncIncludeFromUI();
            const order = getOrder();
            const name = buildFinalFilename(fields, include, order);
            previewEl.textContent = name || '(completa los campos para generar el nombre)';
        };

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

        updatePreview();
    });

    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderFieldRow(label, field, options, defaultValue, { required }) {
    const safeOptions = Array.isArray(options) ? options : [];
    const optHtml = safeOptions.length
        ? safeOptions.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')
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
    const forced = field === 'dni' || field === 'centro';
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
clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    fileInput.value = '';
    updateFileList();
    updateButtons();
    results.style.display = 'none';
});
