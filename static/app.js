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

        if (result.success) {
            div.innerHTML = `
                <div class="result-header">
                    <span class="success-icon">✅</span>
                    <span class="result-original">${result.original_name}</span>
                </div>
                <div class="result-suggested">${result.suggested_name}</div>
                ${result.metadata && Object.keys(result.metadata).length > 0 ? `
                    <div class="result-metadata">
                        ${Object.entries(result.metadata).map(([key, value]) => 
                            `<span class="metadata-badge">${key}: ${value}</span>`
                        ).join('')}
                    </div>
                ` : ''}
            `;
        } else {
            div.innerHTML = `
                <div class="result-header">
                    <span class="error-icon">❌</span>
                    <span class="result-original">${result.original_name}</span>
                </div>
                <div class="result-error">
                    ${result.error || result.message || 'Error al procesar el archivo'}
                </div>
            `;
        }

        resultsContent.appendChild(div);
    });

    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Clear button
clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    fileInput.value = '';
    updateFileList();
    updateButtons();
    results.style.display = 'none';
});
