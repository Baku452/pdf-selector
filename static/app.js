// File handling
let selectedFiles = [];
let excelSession = null;
let excelConfigData = null; // {sheets: [...], columns: {sheetName: [col, ...]}}
let excelConfigApplied = false; // true after user clicks Aplicar successfully
const _cardReanalyzers = {}; // file_index -> applyReanalysis(data)

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

    // Excel upload — click on the excel upload area
    const excelArea = document.getElementById('excelUploadArea');
    const excelInput = document.getElementById('excelInput');
    if (excelArea && excelInput) {
        excelArea.addEventListener('click', () => excelInput.click());
        excelInput.addEventListener('change', () => {
            if (excelInput.files && excelInput.files.length) {
                handleExcelUpload(excelInput.files[0]);
            }
            excelInput.value = '';
        });
    }
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

function handleExcelUpload(file) {
    const statusEl = document.getElementById('excelStatus');
    const excelArea = document.getElementById('excelUploadArea');
    if (!file) return;

    statusEl.textContent = 'Subiendo...';

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload-excel', { method: 'POST', body: formData })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
            if (!ok || !data.success) throw new Error(data.error || 'Error al procesar Excel');
            excelSession = data.excel_session;
            excelConfigData = { sheets: data.sheets || [], columns: data.columns || {} };
            excelConfigApplied = false;
            updateButtons();
            if (data.entries > 0) {
                statusEl.textContent = `${data.filename} (${data.entries} registros)`;
            } else {
                statusEl.textContent = `${data.filename} — selecciona hoja y columnas`;
            }
            statusEl.classList.add('excel-loaded');
            if (excelArea) excelArea.classList.add('excel-active');
            renderExcelConfigPanel(data);
        })
        .catch(err => {
            statusEl.textContent = 'Error: ' + (err.message || err);
            statusEl.classList.remove('excel-loaded');
            if (excelArea) excelArea.classList.remove('excel-active');
            excelSession = null;
            excelConfigData = null;
            excelConfigApplied = false;
            updateButtons();
            const panel = document.getElementById('excelConfigPanel');
            if (panel) panel.style.display = 'none';
        });
}

function renderExcelConfigPanel(data) {
    const panel = document.getElementById('excelConfigPanel');
    if (!panel) return;

    const sheets = data.sheets || [];
    const columns = data.columns || {};

    // Auto-pick a sensible default sheet
    const defaultSheet = sheets.find(s =>
        /rotulo/i.test(s) || /carga/i.test(s)
    ) || sheets[0] || '';

    const sheetOptions = sheets.map(s =>
        `<option value="${escapeHtml(s)}"${s === defaultSheet ? ' selected' : ''}>${escapeHtml(s)}</option>`
    ).join('');

    panel.innerHTML = `
        <div class="excel-config-panel">
            <div class="excel-config-header">
                <span class="excel-config-title">Referencia Excel</span>
                <button class="excel-config-toggle" id="excelConfigToggle" title="Contraer">▲</button>
            </div>
            <div class="excel-config-body" id="excelConfigBody">
                ${data.load_error ? `<p class="excel-config-hint">⚠ ${escapeHtml(data.load_error)} — verifica la hoja y columnas y haz clic en Aplicar.</p>` : ''}
                <div class="excel-config-row">
                    <label class="excel-config-label">Hoja</label>
                    <select class="excel-config-select" id="excelSheetSel">${sheetOptions}</select>
                </div>
                <div id="excelColConfig"></div>
                <div class="excel-config-actions">
                    <button class="btn btn-primary btn-small" id="applyExcelConfigBtn">Aplicar</button>
                    <span class="excel-config-status" id="excelConfigStatus"></span>
                </div>
            </div>
        </div>
    `;
    panel.style.display = 'block';

    updateColumnSelectors(defaultSheet, columns);

    document.getElementById('excelSheetSel').addEventListener('change', e => {
        updateColumnSelectors(e.target.value, columns);
    });

    document.getElementById('applyExcelConfigBtn').addEventListener('click', applyExcelConfig);

    document.getElementById('excelConfigToggle').addEventListener('click', () => {
        const body = document.getElementById('excelConfigBody');
        const btn = document.getElementById('excelConfigToggle');
        if (body.style.display === 'none') {
            body.style.display = '';
            btn.textContent = '▲';
            btn.title = 'Contraer';
        } else {
            body.style.display = 'none';
            btn.textContent = '▼';
            btn.title = 'Expandir';
        }
    });
}

function updateColumnSelectors(sheet, allColumns) {
    const cols = (allColumns[sheet] || []).filter(Boolean);
    const noneOpt = '<option value="">(ninguna)</option>';
    const colOpts = noneOpt + cols.map(c =>
        `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');

    const container = document.getElementById('excelColConfig');
    if (!container) return;
    container.innerHTML = `
        <div class="excel-config-row">
            <label class="excel-config-label">Col. DNI</label>
            <select class="excel-config-select" id="excelDniCol">${colOpts}</select>
        </div>
        <div class="excel-config-row">
            <label class="excel-config-label">Col. Apellidos y Nombres</label>
            <select class="excel-config-select" id="excelPacCol">${colOpts}</select>
        </div>
        <div class="excel-config-row">
            <label class="excel-config-label">Col. Nombre Hudbay</label>
            <select class="excel-config-select" id="excelHudbayCol">${colOpts}</select>
        </div>
        <div class="excel-config-row">
            <label class="excel-config-label">Col. Nombre Estándar</label>
            <select class="excel-config-select" id="excelStandardCol">${colOpts}</select>
        </div>
    `;

    // Auto-select known column names
    _autoSelectCol('excelDniCol',      cols, ['DNI', 'DOCUMENTO', 'Documento', 'N° DOC']);
    _autoSelectCol('excelPacCol',      cols, ['PACIENTE', 'APELLIDOS Y NOMBRES', 'APELLIDOS', 'NOMBRES', 'NOMBRE']);
    _autoSelectCol('excelHudbayCol',   cols, ['EMO HUDBAY', 'HUDBAY', 'nombre excel', 'NOMBRE EXCEL']);
    _autoSelectCol('excelStandardCol', cols, ['EMO BAMBAS', 'BAMBAS', 'nombre excel', 'NOMBRE EXCEL']);
}

function _autoSelectCol(selId, cols, candidates) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    for (const c of candidates) {
        const found = cols.find(col => col.toLowerCase() === c.toLowerCase());
        if (found) { sel.value = found; return; }
    }
}

function applyExcelConfig() {
    const sheet    = document.getElementById('excelSheetSel')?.value;
    const dni_col  = document.getElementById('excelDniCol')?.value || null;
    const pac_col  = document.getElementById('excelPacCol')?.value || null;
    const hudbay_col   = document.getElementById('excelHudbayCol')?.value || null;
    const standard_col = document.getElementById('excelStandardCol')?.value || null;
    const btn    = document.getElementById('applyExcelConfigBtn');
    const status = document.getElementById('excelConfigStatus');

    btn.disabled = true;
    btn.textContent = 'Aplicando…';
    if (status) status.textContent = '';

    fetch(`/api/configure-excel/${excelSession}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet, dni_col, pac_col, hudbay_col, standard_col }),
    })
    .then(r => r.json())
    .then(d => {
        btn.disabled = false;
        btn.textContent = 'Aplicar';
        if (d.success) {
            excelConfigApplied = true;
            updateButtons();
            if (status) status.textContent = `✓ ${d.entries} registros cargados`;
            const statusEl = document.getElementById('excelStatus');
            if (statusEl) {
                statusEl.textContent = statusEl.textContent.replace(/\s*\(\d+ registros\)/, '')
                    + ` (${d.entries} registros)`;
            }
            reanalyzeAllWithExcel();
        } else {
            if (status) status.textContent = 'Error: ' + d.error;
        }
    })
    .catch(() => {
        btn.disabled = false;
        btn.textContent = 'Aplicar';
        if (status) status.textContent = 'Error de conexión';
    });
}

function reanalyzeAllWithExcel() {
    const rc = document.getElementById('resultsContent');
    if (!rc) return;
    const sid = rc.dataset.sessionId;
    if (!sid) return;

    rc.querySelectorAll('[data-file-index]').forEach(card => {
        const idx = card.dataset.fileIndex;
        const radio = card.querySelector('input[name^="format_"]:checked');
        const format = radio ? radio.value : 'standard';

        fetch(`/api/reanalyze/${sid}/${idx}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format, excel_session: excelSession }),
        })
        .then(r => r.json())
        .then(data => {
            if (data.candidates && _cardReanalyzers[idx]) {
                _cardReanalyzers[idx](data);
            }
        })
        .catch(() => {});
    });
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
    const excelPending = excelSession && !excelConfigApplied;
    processBtn.disabled = selectedFiles.length === 0 || excelPending;
    if (excelPending && selectedFiles.length > 0) {
        processBtn.title = 'Primero aplica la configuración del Excel';
    } else {
        processBtn.title = '';
    }
    clearBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function calcMatchPercentage(name1, name2) {
    if (!name1 || !name2) return 0;
    const a = name1.toUpperCase().replace(/\.pdf$/i, '');
    const b = name2.toUpperCase().replace(/\.pdf$/i, '');
    // Simple character-level similarity (Levenshtein-like via longest common subsequence)
    const len1 = a.length, len2 = b.length;
    if (len1 === 0 || len2 === 0) return 0;
    // Use a simple approach: count matching chars in order
    let matches = 0, j = 0;
    for (let i = 0; i < len1 && j < len2; i++) {
        if (a[i] === b[j]) { matches++; j++; }
        else {
            // Try skipping in either string
            if (j + 1 < len2 && a[i] === b[j + 1]) { j++; matches++; j++; }
        }
    }
    return Math.round((matches / Math.max(len1, len2)) * 1000) / 10;
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

/**
 * Compute Excel match status info from raw result fields.
 * Returns null when no Excel is loaded.
 * Matching key: DNI (primary lookup), name similarity (confidence check).
 */
function excelMatchInfo(excelDniFnd, matchPct, nombreExcel) {
    if (excelDniFnd === null || excelDniFnd === undefined) return null;
    if (excelDniFnd === false) {
        return { status: 'notfound', matchPct: null };
    }
    // DNI was found in Excel
    if (matchPct == null) {
        return { status: 'partial', matchPct: null };
    }
    if (matchPct >= 80) return { status: 'found',   matchPct };
    if (matchPct >= 50) return { status: 'partial', matchPct };
    return                     { status: 'warning', matchPct };
}

function excelBannerHTML(info) {
    if (!info) return '';
    const texts = {
        found:    { icon: '✓', msg: `Encontrado en Excel` },
        partial:  { icon: '~', msg: `Coincidencia parcial en Excel` },
        warning:  { icon: '⚠', msg: `Baja coincidencia en Excel` },
        notfound: { icon: '✗', msg: 'No encontrado en el Excel' },
    };
    const t = texts[info.status];
    const pctPart = info.matchPct != null ? ` &mdash; <strong>${info.matchPct}%</strong>` : '';
    return `<div class="excel-status-banner ${info.status}" data-role="excel-banner">
        <span class="banner-icon">${t.icon}</span>
        <span>${t.msg}${pctPart}</span>
    </div>`;
}

function applyExcelStatus(cardEl, info) {
    ['excel-found', 'excel-partial', 'excel-warning', 'excel-notfound'].forEach(c => cardEl.classList.remove(c));
    if (info) cardEl.classList.add('excel-' + info.status);
    // Update banner text and class
    const banner = cardEl.querySelector('[data-role="excel-banner"]');
    if (banner && info) {
        const texts = {
            found:    { icon: '✓', msg: 'Encontrado en Excel' },
            partial:  { icon: '~', msg: 'Coincidencia parcial en Excel' },
            warning:  { icon: '⚠', msg: 'Baja coincidencia en Excel' },
            notfound: { icon: '✗', msg: 'No encontrado en el Excel' },
        };
        const t = texts[info.status];
        const pctPart = info.matchPct != null ? ` — ${info.matchPct}%` : '';
        banner.className = `excel-status-banner ${info.status}`;
        banner.innerHTML = `<span class="banner-icon">${t.icon}</span><span>${t.msg}${pctPart}</span>`;
    }
}

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

var BATCH_SIZE = 5; // Files per upload request to avoid 413 errors

function onProcessClick() {
    if (selectedFiles.length === 0) return;
    processBtn.disabled = true;
    var btnText = processBtn.querySelector('.btn-text');
    var btnLoader = processBtn.querySelector('.btn-loader');
    if (btnText) btnText.textContent = 'Procesando...';
    if (btnLoader) btnLoader.style.display = 'inline-block';
    if (results) results.style.display = 'none';

    // Split files into batches
    var batches = [];
    for (var i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
        batches.push(selectedFiles.slice(i, i + BATCH_SIZE));
    }

    var sessionId = null;
    var allResults = [];
    var fileIndexStart = 0;
    var totalBatches = batches.length;

    function uploadBatch(batchIdx) {
        if (batchIdx >= totalBatches) {
            // All batches done
            displayResults(allResults, sessionId);
            processBtn.disabled = false;
            if (btnText) btnText.textContent = 'Procesar PDFs';
            if (btnLoader) btnLoader.style.display = 'none';
            return;
        }

        if (btnText) btnText.textContent = 'Procesando... (' + (batchIdx + 1) + '/' + totalBatches + ')';

        var batch = batches[batchIdx];
        var formData = new FormData();
        batch.forEach(function (file) { formData.append('files', file); });
        if (excelSession) formData.append('excel_session', excelSession);
        if (sessionId) formData.append('session_id', sessionId);
        formData.append('file_index_start', String(fileIndexStart));

        fetch('/api/upload', { method: 'POST', body: formData })
            .then(function (r) {
                var contentType = r.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    if (r.status === 413) throw new Error('Lote demasiado grande. Reduce el número de archivos.');
                    throw new Error('Error del servidor (' + r.status + '). Intenta de nuevo.');
                }
                return r.json().then(function (data) { return { ok: r.ok, data: data }; });
            })
            .then(function (_) {
                var ok = _.ok, data = _.data;
                if (!ok) throw new Error(data.error || 'Error al procesar los archivos');
                if (!sessionId) sessionId = data.session_id;
                allResults = allResults.concat(data.results || []);
                // Count files that got a file_index (successfully saved)
                var saved = (data.results || []).filter(function(r) { return r.file_index != null; }).length;
                fileIndexStart += saved;
                uploadBatch(batchIdx + 1);
            })
            .catch(function (err) {
                alert('Error en lote ' + (batchIdx + 1) + ': ' + (err.message || err));
                processBtn.disabled = false;
                if (btnText) btnText.textContent = 'Procesar PDFs';
                if (btnLoader) btnLoader.style.display = 'none';
                // Show partial results if any
                if (allResults.length > 0) displayResults(allResults, sessionId);
            });
    }

    uploadBatch(0);
}

function displayResults(resultsData, sessionId) {
    results.style.display = 'block';
    resultsContent.innerHTML = '';
    resultsContent.dataset.sessionId = sessionId || '';
    _previewUpdaters.length = 0;
    Object.keys(_cardReanalyzers).forEach(k => delete _cardReanalyzers[k]);

    resultsData.forEach(result => {
        const div = document.createElement('div');
        div.className = 'result-item';
        if (result.file_index != null) div.dataset.fileIndex = String(result.file_index);
        if (result.match_percentage != null) div.dataset.matchPct = String(result.match_percentage);

        // Apply initial Excel match border
        const initExcelInfo = excelSession
            ? excelMatchInfo(result.excel_dni_found, result.match_percentage, result.nombre_excel)
            : null;
        if (initExcelInfo) div.classList.add('excel-' + initExcelInfo.status);

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

        const extractionPill = result.success
            ? `<span class="extraction-pill ok">✓ Datos extraídos</span>`
            : `<span class="extraction-pill warn">⚠ Faltan campos</span>`;

        const FIELD_COLORS = {
            dni: '#ff6b6b',
            nombre: '#4ecdc4',
            empresa: '#45b7d1',
            tipo_examen: '#f7b731',
            fecha: '#5f27cd',
        };
        const FIELD_LABELS = { dni: 'DNI', nombre: 'Nombre', empresa: 'Empresa', tipo_examen: 'Tipo', fecha: 'Fecha' };

        div.innerHTML = `
            <div class="result-header" data-action="toggle-collapse">
                <span class="result-original">${result.original_name}</span>
                <div class="result-header-right">
                    ${extractionPill}
                    <button class="collapse-toggle" title="Contraer / Expandir" tabindex="-1">▾</button>
                </div>
            </div>



            <div class="result-body">
            ${notes.length ? `
                <div class="result-notes">
                    ${notes.map(n => `<div class="note-item">${n}</div>`).join('')}
                </div>
            ` : ''}

            <div class="result-content-split">
                <div class="result-fields-panel">
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
                        ${excelBannerHTML(initExcelInfo)}   
                        <div class="preview-label">
                            Nombre generado
                            <span class="preview-label-badge" data-role="preview-badge">auto</span>
                            <button class="btn-regenerate" data-action="regenerate" title="Regenerar desde campos" style="display:none">↺ Regenerar</button>
                        </div>
                        <div class="result-suggested" data-role="preview" contenteditable="true" spellcheck="false"></div>
                        ${(excelSession && result.nombre_excel) ? `
                        <div class="excel-suggestion" data-role="excel-name-section">
                            <div class="excel-suggestion-body">
                                <span class="excel-suggestion-label">Referencia Excel</span>
                                <span class="excel-name-value" data-role="nombre-excel">${escapeHtml(result.nombre_excel)}</span>
                            </div>
                            <button class="btn btn-outline btn-small" data-action="use-excel-name" title="Reemplazar el nombre generado con el del Excel">Aplicar</button>
                        </div>` : ''}
                        <div class="preview-actions">
                            <button class="btn btn-ghost btn-small" data-action="copy">Copiar</button>
                            ${result.file_index != null ? `<button class="btn btn-primary btn-small" data-action="download-one">Descargar PDF</button>` : ''}
                        </div>
                    </div>
                </div>

                <div class="result-preview-panel" data-role="pdf-preview">
                    <div class="preview-toolbar">
                        <button class="preview-tool-btn" data-action="zoom-out" title="Alejar">-</button>
                        <span class="preview-zoom-label">100%</span>
                        <button class="preview-tool-btn" data-action="zoom-in" title="Acercar">+</button>
                        <span class="preview-page-info">Pag <span data-role="current-page">1</span> / <span data-role="total-pages">1</span></span>
                    </div>
                    <div class="preview-scroll-container">
                        <div class="preview-pages-wrap" data-role="pages-wrap">
                            <div class="preview-loading">Cargando vista previa...</div>
                        </div>
                    </div>
                    <div class="preview-legend">
                        ${Object.entries(FIELD_COLORS).map(([f, c]) =>
                            `<span class="legend-item" data-legend-field="${f}"><span class="legend-swatch" style="background:${c}"></span>${FIELD_LABELS[f]}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
            </div>
        `;

        resultsContent.appendChild(div);

        // Collapse toggle
        div.querySelector('[data-action="toggle-collapse"]').addEventListener('click', () => {
            div.classList.toggle('collapsed');
            div.querySelector('.collapse-toggle').textContent = div.classList.contains('collapsed') ? '▸' : '▾';
        });

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

        // Store nombre_excel for this card
        let currentNombreExcel = result.nombre_excel || null;
        let userEditedPreview = false;

        const previewEl = div.querySelector('[data-role="preview"]');
        const previewBadge = div.querySelector('[data-role="preview-badge"]');
        const regenerateBtn = div.querySelector('[data-action="regenerate"]');

        const setPreviewUserEdited = (edited) => {
            userEditedPreview = edited;
            if (previewBadge) {
                previewBadge.textContent = edited ? 'editado' : 'auto';
                previewBadge.classList.toggle('preview-badge-edited', edited);
            }
            if (regenerateBtn) regenerateBtn.style.display = edited ? '' : 'none';
        };

        const updatePreview = () => {
            if (userEditedPreview) return;
            const fields = getFields();
            syncIncludeFromUI();
            const name = buildFinalFilename(fields, include, null, div);
            previewEl.textContent = name || '(completa los campos para generar el nombre)';

            // Update Excel banner when filename changes
            if (currentNombreExcel && name) {
                const pct = calcMatchPercentage(name, currentNombreExcel);
                applyExcelStatus(div, excelMatchInfo(true, pct, currentNombreExcel));
            }
        };
        _previewUpdaters.push(updatePreview);

        // Detect user edits on the contenteditable preview
        previewEl.addEventListener('input', () => setPreviewUserEdited(true));

        // Regenerate button resets to auto-generated name
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                setPreviewUserEdited(false);
                updatePreview();
            });
        }

        // "Use excel name" button
        const useExcelBtn = div.querySelector('[data-action="use-excel-name"]');
        if (useExcelBtn && currentNombreExcel) {
            useExcelBtn.addEventListener('click', () => {
                previewEl.textContent = currentNombreExcel;
                setPreviewUserEdited(true);
            });
        }

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

        // Helper to update field UI from re-analysis data
        const applyReanalysis = (data) => {
            const candidates = data.candidates || {};
            const defaults = data.defaults || {};
            // Update selects and inputs
            ['dni', 'nombre', 'empresa', 'tipo_examen', 'fecha'].forEach(field => {
                const sel = div.querySelector(`[data-field-select="${field}"]`);
                const inp = div.querySelector(`[data-field-input="${field}"]`);
                if (sel) {
                    const opts = candidates[field] || [];
                    const defVal = defaults[field] || '';
                    sel.innerHTML = '<option value="">(seleccionar)</option>' +
                        opts.map(v => {
                            const display = field === 'tipo_examen' ? examTypeDisplayLabel(v) : v;
                            const selected = v === defVal ? ' selected' : '';
                            return `<option value="${escapeHtml(v)}"${selected}>${escapeHtml(display)}</option>`;
                        }).join('');
                }
                if (inp) {
                    const defVal = defaults[field] || '';
                    inp.value = field === 'tipo_examen' ? (EXAM_TYPE_ABBR[defVal] || defVal) : defVal;
                }
            });
            // Update nombre_excel and match info
            if (data.nombre_excel) {
                currentNombreExcel = data.nombre_excel;
                const neEl = div.querySelector('[data-role="nombre-excel"]');
                if (neEl) {
                    neEl.textContent = data.nombre_excel;
                } else {
                    const previewBlock = div.querySelector('.preview-block');
                    const actions = previewBlock && previewBlock.querySelector('.preview-actions');
                    const nameRow = document.createElement('div');
                    nameRow.className = 'excel-suggestion';
                    nameRow.dataset.role = 'excel-name-section';
                    nameRow.innerHTML = `
                        <div class="excel-suggestion-body">
                            <span class="excel-suggestion-label">Referencia Excel</span>
                            <span class="excel-name-value" data-role="nombre-excel">${escapeHtml(data.nombre_excel)}</span>
                        </div>
                        <button class="btn btn-outline btn-small" data-action="use-excel-name" title="Reemplazar con nombre del Excel">Aplicar</button>
                    `;
                    nameRow.querySelector('[data-action="use-excel-name"]').addEventListener('click', () => {
                        previewEl.textContent = currentNombreExcel;
                        setPreviewUserEdited(true);
                    });
                    if (actions) previewBlock.insertBefore(nameRow, actions);
                }
                applyExcelStatus(div, excelMatchInfo(true, data.match_percentage, data.nombre_excel));
                if (data.match_percentage != null) {
                    div.dataset.matchPct = String(data.match_percentage);
                    resultsContent.dispatchEvent(new Event('matchPctUpdated'));
                }
            } else {
                const info = excelMatchInfo(data.excel_dni_found, null, null);
                if (info) applyExcelStatus(div, info);
            }
            updateNombreBadge();
            updatePreview();
        };

        // format radio -> re-extract from correct page and update fields
        div.querySelectorAll('input[name^="format_"]').forEach(radio => {
            radio.addEventListener('change', () => {
                reorderFields(radio.value);
                // Call re-analyze API to extract from correct page
                const sid = resultsContent.dataset.sessionId;
                const idx = div.dataset.fileIndex;
                if (sid && idx != null) {
                    const body = { format: radio.value };
                    if (excelSession) body.excel_session = excelSession;
                    fetch(`/api/reanalyze/${sid}/${idx}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.candidates) applyReanalysis(data);
                    })
                    .catch(() => {});
                } else {
                    updatePreview();
                }
            });
        });

        // select -> input
        div.querySelectorAll('[data-field-select]').forEach(sel => {
            sel.addEventListener('change', () => {
                const field = sel.getAttribute('data-field-select');
                const input = div.querySelector(`[data-field-input="${field}"]`);
                let val = sel.value || '';
                if (field === 'tipo_examen' && val) val = EXAM_TYPE_ABBR[val] || val;
                if (input) input.value = val;
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
            const preview = previewEl.textContent || '';
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
                const preview = previewEl.textContent || '';
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

        // --- PDF preview with highlights, zoom, multi-page scroll ---
        if (result.file_index != null) {
            const previewPanel = div.querySelector('[data-role="pdf-preview"]');
            const pagesWrap = previewPanel.querySelector('[data-role="pages-wrap"]');
            const scrollContainer = previewPanel.querySelector('.preview-scroll-container');
            const zoomLabel = previewPanel.querySelector('.preview-zoom-label');
            const currentPageEl = previewPanel.querySelector('[data-role="current-page"]');
            const totalPagesEl = previewPanel.querySelector('[data-role="total-pages"]');
            let previewPages = null; // array of { image, width, height, highlights, page }
            let activeField = null;
            let zoomLevel = 1;
            const ZOOM_STEP = 0.25;
            const ZOOM_MIN = 0.5;
            const ZOOM_MAX = 3;

            const drawPageHighlights = (canvas, highlights, selectedField) => {
                const ctx = canvas.getContext('2d');
                const img = canvas._previewImg;
                if (!img) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Draw highlight boxes first, then labels on top
                highlights.forEach(h => {
                    const isActive = selectedField === h.field;
                    ctx.fillStyle = h.color + (isActive ? '60' : '25');
                    ctx.fillRect(h.x, h.y, h.w, h.h);
                    ctx.strokeStyle = h.color + (isActive ? 'ff' : '80');
                    ctx.lineWidth = isActive ? 2.5 : 1.5;
                    ctx.strokeRect(h.x, h.y, h.w, h.h);
                });

                // Draw field name tag only for the active (hovered/focused) field
                if (selectedField) {
                    const tagFontSize = Math.max(10, Math.round(canvas.width * 0.018));
                    const tagPad = Math.round(tagFontSize * 0.35);
                    ctx.font = `600 ${tagFontSize}px system-ui, sans-serif`;
                    highlights.forEach(h => {
                        if (h.field !== selectedField) return;
                        const label = FIELD_LABELS[h.field] || h.field;
                        const tw = ctx.measureText(label).width;
                        const tagW = tw + tagPad * 2;
                        const tagH = tagFontSize + tagPad * 2;
                        const tagX = h.x;
                        const tagY = h.y - tagH - 2;
                        const clampedY = Math.max(0, tagY);

                        ctx.fillStyle = h.color + 'ff';
                        ctx.beginPath();
                        ctx.roundRect(tagX, clampedY, tagW, tagH, tagH / 2);
                        ctx.fill();

                        ctx.fillStyle = '#fff';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(label, tagX + tagPad, clampedY + tagH / 2);
                    });
                }
            };

            const redrawAllHighlights = (selectedField) => {
                if (!previewPages) return;
                pagesWrap.querySelectorAll('canvas').forEach((canvas) => {
                    const wrap = canvas.closest('.preview-canvas-wrap');
                    const pageNum = parseInt(wrap?.dataset.pageNum || '1');
                    const pg = previewPages[pageNum - 1];
                    if (pg) {
                        drawPageHighlights(canvas, pg.highlights, selectedField);
                    }
                });
            };

            const applyZoom = () => {
                zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
                pagesWrap.style.width = Math.round(zoomLevel * 100) + '%';
            };

            const updateCurrentPage = () => {
                if (!previewPages || previewPages.length <= 1) return;
                const canvases = pagesWrap.querySelectorAll('canvas');
                const scrollTop = scrollContainer.scrollTop;
                const containerTop = scrollContainer.getBoundingClientRect().top;
                let closest = 1;
                canvases.forEach((c, i) => {
                    const rect = c.getBoundingClientRect();
                    if (rect.top - containerTop < scrollContainer.clientHeight / 2) {
                        closest = i + 1;
                    }
                });
                currentPageEl.textContent = closest;
            };

            scrollContainer.addEventListener('scroll', updateCurrentPage);

            // Zoom buttons
            previewPanel.querySelector('[data-action="zoom-in"]').addEventListener('click', () => {
                if (zoomLevel < ZOOM_MAX) { zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP); applyZoom(); }
            });
            previewPanel.querySelector('[data-action="zoom-out"]').addEventListener('click', () => {
                if (zoomLevel > ZOOM_MIN) { zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP); applyZoom(); }
            });

            // Only load the single page used for data extraction
            const extractPage = result.detected_format === 'standard' ? 1 : 0;
            let totalPages = 1;
            let loadedPages = new Set();

            const addPageToWrap = (pg) => {
                const canvasWrap = document.createElement('div');
                canvasWrap.className = 'preview-canvas-wrap';
                canvasWrap.dataset.pageNum = pg.page;
                const pageLabel = document.createElement('div');
                pageLabel.className = 'preview-page-label';
                pageLabel.textContent = 'Pag ' + pg.page;
                canvasWrap.appendChild(pageLabel);

                const canvas = document.createElement('canvas');
                canvas.width = pg.width;
                canvas.height = pg.height;
                canvasWrap.appendChild(canvas);

                // Insert in order
                const existing = pagesWrap.querySelectorAll('.preview-canvas-wrap');
                let inserted = false;
                for (const el of existing) {
                    if (parseInt(el.dataset.pageNum) > pg.page) {
                        pagesWrap.insertBefore(canvasWrap, el);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) pagesWrap.appendChild(canvasWrap);

                // Hover over a highlight region in the canvas → show that field's tag
                canvas.addEventListener('mousemove', (e) => {
                    if (!pg.highlights || pg.highlights.length === 0) return;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const cx = (e.clientX - rect.left) * scaleX;
                    const cy = (e.clientY - rect.top) * scaleY;
                    const hit = pg.highlights.find(h =>
                        cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h
                    );
                    const field = hit ? hit.field : null;
                    if (field !== activeField) {
                        activeField = field;
                        canvas.style.cursor = field ? 'crosshair' : '';
                        redrawAllHighlights(field);
                    }
                });
                canvas.addEventListener('mouseleave', () => {
                    if (activeField !== null) {
                        activeField = null;
                        canvas.style.cursor = '';
                        redrawAllHighlights(null);
                    }
                });

                const img = new window.Image();
                img.onload = () => {
                    canvas._previewImg = img;
                    drawPageHighlights(canvas, pg.highlights, activeField);
                    // Auto-zoom + scroll to the extracted fields region
                    if (pg.highlights && pg.highlights.length > 0) {
                        requestAnimationFrame(() => {
                            const padding = 40;
                            const rawMinY = Math.min(...pg.highlights.map(h => h.y)) - padding;
                            const rawMaxY = Math.max(...pg.highlights.map(h => h.y + h.h)) + padding;
                            const regionH = rawMaxY - rawMinY;
                            const cw = scrollContainer.clientWidth || 400;
                            const ch = scrollContainer.clientHeight || 400;
                            // Zoom so the highlights region fills ~75% of container height, cap at 2.0
                            const baseScale = cw / canvas.width;
                            const targetZoom = (ch * 0.75) / (regionH * baseScale);
                            zoomLevel = Math.max(1.0, Math.min(2.0, targetZoom));
                            applyZoom();
                            // Center the fields region in the scroll container.
                            // applyZoom sets pagesWrap width = zoomLevel * 100% of scrollContainer,
                            // so the canvas renders at cw * zoomLevel pixels wide — compute scale
                            // directly without relying on a post-reflow offsetWidth read.
                            requestAnimationFrame(() => {
                                const scale = (cw * zoomLevel) / canvas.width;
                                const regionCenterY = ((rawMinY + rawMaxY) / 2) * scale;
                                scrollContainer.scrollTop = Math.max(0, regionCenterY - ch / 2);
                            });
                        });
                    }
                };
                img.src = pg.image;

                if (!previewPages) previewPages = [];
                previewPages[pg.page - 1] = pg;
                loadedPages.add(pg.page - 1);
            };

            const loadPreview = () => {
                if (previewPages) return;
                const sid = resultsContent.dataset.sessionId;
                const idx = result.file_index;
                pagesWrap.innerHTML = '<div class="preview-loading">Cargando vista previa...</div>';

                fetch(`/api/preview/${sid}/${idx}?page=${extractPage}`)
                    .then(r => r.json())
                    .then(data => {
                        if (!data.success || !data.page) {
                            pagesWrap.innerHTML = '<div class="preview-loading">Vista previa no disponible</div>';
                            return;
                        }
                        totalPages = 1;
                        totalPagesEl.textContent = 1;
                        pagesWrap.innerHTML = '';
                        addPageToWrap(data.page);
                    })
                    .catch(() => {
                        pagesWrap.innerHTML = '<div class="preview-loading">Error al cargar vista previa</div>';
                    });
            };

            // Lazy load with IntersectionObserver
            if ('IntersectionObserver' in window) {
                const obs = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        loadPreview();
                        obs.disconnect();
                    }
                }, { rootMargin: '200px' });
                obs.observe(previewPanel);
            } else {
                loadPreview();
            }

            // Apply field color variables to rows and wire hover + focus/blur
            div.querySelectorAll('[data-field-row]').forEach(row => {
                const field = row.dataset.fieldRow;
                const color = FIELD_COLORS[field];
                if (color) row.style.setProperty('--field-color', color);
                row.addEventListener('mouseenter', () => {
                    row.classList.add('field-hovered');
                    redrawAllHighlights(field);
                });
                row.addEventListener('mouseleave', () => {
                    row.classList.remove('field-hovered');
                    redrawAllHighlights(activeField);
                });
            });
            div.querySelectorAll('[data-field-input], [data-field-select]').forEach(el => {
                const field = el.getAttribute('data-field-input') || el.getAttribute('data-field-select');
                el.addEventListener('focus', () => {
                    activeField = field;
                    div.querySelectorAll('[data-field-row]').forEach(r => r.classList.remove('field-hovered'));
                    div.querySelector(`[data-field-row="${field}"]`)?.classList.add('field-hovered');
                    redrawAllHighlights(field);
                });
                el.addEventListener('blur', () => {
                    activeField = null;
                    div.querySelector(`[data-field-row="${field}"]`)?.classList.remove('field-hovered');
                    redrawAllHighlights(null);
                });
            });

            // Legend click -> highlight that field
            previewPanel.querySelectorAll('[data-legend-field]').forEach(el => {
                el.addEventListener('click', () => {
                    const f = el.getAttribute('data-legend-field');
                    activeField = activeField === f ? null : f;
                    redrawAllHighlights(activeField);
                });
            });
        }

        // Register reanalyzer so external callers (applyExcelConfig) can update this card
        if (result.file_index != null) {
            _cardReanalyzers[String(result.file_index)] = applyReanalysis;
        }
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
                a.download = 'CAMBIO_NOMBRE_descargas.zip';
                a.rel = 'noopener';
                a.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('Error: ' + (e.message || e));
            }
        });
    }

    // Fixed filter widget (only when Excel session active and there are match percentages)
    const existingWidget = document.getElementById('matchFilterWidget');
    if (existingWidget) existingWidget.remove();

    const cardsWithPct = Array.from(resultsContent.querySelectorAll('[data-match-pct]'));
    if (excelSession && cardsWithPct.length > 0) {
        const widget = document.createElement('div');
        widget.id = 'matchFilterWidget';
        widget.className = 'match-filter-widget';

        const updateWidgetCount = () => {
            const all = Array.from(resultsContent.querySelectorAll('[data-match-pct]'));
            const pending = all.filter(c => parseFloat(c.dataset.matchPct) < 100).length;
            widget.querySelector('.widget-count').textContent =
                `${pending} pendiente${pending !== 1 ? 's' : ''} de ${all.length}`;
        };

        widget.innerHTML = `
            <span class="widget-title">Revisión</span>
            <span class="widget-count"></span>
            <div class="widget-divider"></div>
            <button class="widget-btn" id="collapseMatchedBtn">Colapsar completados</button>
            <button class="widget-btn widget-btn-outline" id="expandAllBtn">Expandir todo</button>
        `;
        results.insertBefore(widget, resultsContent);
        updateWidgetCount();

        document.getElementById('collapseMatchedBtn').addEventListener('click', () => {
            resultsContent.querySelectorAll('[data-match-pct]').forEach(card => {
                const pct = parseFloat(card.dataset.matchPct);
                if (pct >= 100) {
                    card.classList.add('collapsed');
                    const btn = card.querySelector('.collapse-toggle');
                    if (btn) btn.textContent = '▸';
                }
            });
        });

        document.getElementById('expandAllBtn').addEventListener('click', () => {
            resultsContent.querySelectorAll('.result-item').forEach(card => {
                card.classList.remove('collapsed');
                const btn = card.querySelector('.collapse-toggle');
                if (btn) btn.textContent = '▾';
            });
        });

        // Keep count in sync when match_pct changes (reanalysis updates data-match-pct)
        resultsContent.addEventListener('matchPctUpdated', updateWidgetCount);
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
        <div class="field-row" data-field-row="${field}">
            <div class="field-label">
                <div class="field-title">
                    <span class="field-color-dot"></span>
                    <span>${escapeHtml(label)}</span>
                    ${required ? `<span class="pill pill-required">requerido</span>` : `<span class="pill pill-optional">opcional</span>`}
                </div>
            </div>
            <select class="field-select" data-field-select="${field}">
                <option value="">(seleccionar)</option>
                ${optHtml}
            </select>
            <input class="field-input" data-field-input="${field}" type="text" value="${escapeHtml(field === 'tipo_examen' ? (EXAM_TYPE_ABBR[defaultValue] || defaultValue || '') : (defaultValue || ''))}" placeholder="${required ? 'requerido' : 'opcional'}" />
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
    excelSession = null;
    excelConfigData = null;
    if (fileInput) fileInput.value = '';
    updateFileList();
    updateButtons();
    if (results) results.style.display = 'none';
    const statusEl = document.getElementById('excelStatus');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.remove('excel-loaded');
    }
    const configPanel = document.getElementById('excelConfigPanel');
    if (configPanel) { configPanel.style.display = 'none'; configPanel.innerHTML = ''; }
    const excelArea = document.getElementById('excelUploadArea');
    if (excelArea) excelArea.classList.remove('excel-active');
}
