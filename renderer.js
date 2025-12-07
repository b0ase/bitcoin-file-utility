const { ipcRenderer } = require('electron');

// DOM elements
const folderSelector = document.getElementById('folderSelector');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const changeFolderBtn = document.getElementById('changeFolderBtn');
const selectedFolder = document.getElementById('selectedFolder');
const folderPath = document.getElementById('folderPath');
const dropZone = document.getElementById('dropZone');
const processing = document.getElementById('processing');
const results = document.getElementById('results');
const resetBtn = document.getElementById('resetBtn');
const totalFilesEl = document.getElementById('totalFiles');
const filesRenamedEl = document.getElementById('filesRenamed');
const duplicatesMovedToTrashEl = document.getElementById('duplicatesMovedToTrash');
const quarantineInfoEl = document.getElementById('quarantineInfo');
const errorsEl = document.getElementById('errors');
const errorListEl = document.getElementById('errorList');
const dropNote = document.getElementById('dropNote');
const modeInplace = document.getElementById('modeInplace');
const modeMove = document.getElementById('modeMove');
const sortByDate = document.getElementById('sortByDate');
const sortByColor = document.getElementById('sortByColor');
const sortByBitcoin = document.getElementById('sortByBitcoin');
const terminalContent = document.getElementById('terminalContent');
const clearTerminal = document.getElementById('clearTerminal');
const sortIntoFoldersToggle = document.getElementById('sortIntoFoldersToggle');
const extractFoldersToggle = document.getElementById('extractFoldersToggle');
const dropZoneTitle = document.querySelector('.drop-zone h2');

// State management
let currentState = 'ready'; // ready, processing, complete
let selectedDestinationFolder = null;
let processingMode = 'inplace'; // 'inplace' or 'move'
let sortIntoFolders = false;
let extractFoldersMode = false; // Whether to extract folder contents

// Media file extensions
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'];
const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv', '.3gp', '.mts', '.m2ts'];
const mediaExtensions = [...imageExtensions, ...videoExtensions];

// Mode toggle functionality
function updateMode() {
    processingMode = modeInplace.checked ? 'inplace' : 'move';
    
    if (processingMode === 'inplace') {
        // Hide folder selector, enable drop zone
        folderSelector.classList.add('hidden');
        dropZone.classList.remove('disabled');
        dropZone.classList.add('active');
        let noteHtml = '<p><strong>Note:</strong> Images will be renamed by their original date in their current location. Duplicates will be safely quarantined (not deleted).</p>';
        if (extractFoldersMode) {
            noteHtml += '<p><strong>Extraction Mode ON:</strong> Dropped folders will have their contents extracted to parent directory.</p>';
        }
        dropNote.innerHTML = noteHtml;
    } else {
        // Show folder selector
        folderSelector.classList.remove('hidden');
        let noteHtml = '<p><strong>Note:</strong> Images will be renamed by date and moved to your selected folder. Duplicates will be safely quarantined (not deleted).</p>';
        if (extractFoldersMode) {
            noteHtml += '<p><strong>Extraction Mode ON:</strong> Dropped folders will have their contents extracted to parent directory.</p>';
        }
        dropNote.innerHTML = noteHtml;
        updateDropZoneState();
    }
}

// Add event listeners for mode toggle
modeInplace.addEventListener('change', updateMode);
modeMove.addEventListener('change', updateMode);

// Toggle handler for sorting into folders
sortIntoFoldersToggle.addEventListener('change', (e) => {
    sortIntoFolders = e.target.checked;
    addTerminalLine(`📁 Sort into dated folders: ${sortIntoFolders ? 'ENABLED' : 'DISABLED'}`);
});

// Toggle handler for folder extraction mode
extractFoldersToggle.addEventListener('change', (e) => {
    extractFoldersMode = e.target.checked;
    
    // Update UI to reflect extraction mode
    if (extractFoldersMode) {
        dropZoneTitle.textContent = 'Drop Media Files or Folders Here';
        const dropZoneP = document.querySelector('.drop-zone .drop-content > p');
        dropZoneP.innerHTML = 'Images: JPG, PNG, GIF, BMP, TIFF, WEBP<br>Videos: MP4, MOV, AVI, MKV, WEBM, M4V, etc.<br><strong>Folders:</strong> Extract all contents to parent directory';
        addTerminalLine(`📤 Folder extraction mode: ENABLED - Folders will be extracted`);
    } else {
        dropZoneTitle.textContent = 'Drop Media Files Here';
        const dropZoneP = document.querySelector('.drop-zone .drop-content > p');
        dropZoneP.innerHTML = 'Images: JPG, PNG, GIF, BMP, TIFF, WEBP<br>Videos: MP4, MOV, AVI, MKV, WEBM, M4V, etc.';
        addTerminalLine(`📤 Folder extraction mode: DISABLED - Folders will process files inside`);
    }
});

function showSection(section) {
    // Hide all sections
    processing.classList.add('hidden');
    results.classList.add('hidden');
    
    // Show requested section
    switch(section) {
        case 'ready':
            // Always show folder selector and drop zone based on mode
            updateMode();
            break;
        case 'processing':
            processing.classList.remove('hidden');
            break;
        case 'results':
            results.classList.remove('hidden');
            // Keep drop zone available for immediate re-use
            break;
    }
    
    currentState = section;
}

function updateDropZoneState() {
    if (processingMode === 'inplace') {
        // Always active in in-place mode
        dropZone.classList.remove('disabled');
        dropZone.classList.add('active');
    } else {
        // Only active if folder selected in move mode
        if (selectedDestinationFolder) {
            dropZone.classList.remove('disabled');
            dropZone.classList.add('active');
        } else {
            dropZone.classList.add('disabled');
            dropZone.classList.remove('active');
        }
    }
}

function showResults(data) {
    totalFilesEl.textContent = data.totalFiles || 0;
    filesRenamedEl.textContent = data.filesRenamed || 0;
    duplicatesMovedToTrashEl.textContent = data.duplicatesMovedToTrash || 0;
    
    // Show quarantine info if files were quarantined
    if (data.quarantinedFiles && data.quarantinedFiles.length > 0) {
        if (!quarantineInfoEl) {
            // Create quarantine info element if it doesn't exist
            const quarantineDiv = document.createElement('div');
            quarantineDiv.id = 'quarantineInfo';
            quarantineDiv.className = 'quarantine-info';
            quarantineDiv.innerHTML = `
                <p class="warning">⚠️ ${data.quarantinedFiles.length} duplicate(s) moved to quarantine folder</p>
                <p class="info">Files are safely stored in '_FileRenamer_Quarantine' folder for recovery</p>
            `;
            const resultsDiv = document.getElementById('results');
            resultsDiv.insertBefore(quarantineDiv, resultsDiv.querySelector('.errors'));
        } else {
            quarantineInfoEl.classList.remove('hidden');
            quarantineInfoEl.innerHTML = `
                <p class="warning">⚠️ ${data.quarantinedFiles.length} duplicate(s) moved to quarantine folder</p>
                <p class="info">Files are safely stored in '_FileRenamer_Quarantine' folder for recovery</p>
            `;
        }
    }
    
    // Show errors if any
    if (data.errors && data.errors.length > 0) {
        errorsEl.classList.remove('hidden');
        errorListEl.innerHTML = '';
        data.errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errorListEl.appendChild(li);
        });
    } else {
        errorsEl.classList.add('hidden');
    }
    
    showSection('results');
    
    // Auto-reset countdown for seamless workflow
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        resetBtn.textContent = `Drop More Images (Auto-reset in ${countdown}s)`;
        countdown--;
        
        if (countdown < 0) {
            clearInterval(countdownInterval);
            if (currentState === 'results') {
                showSection('ready');
                resetBtn.textContent = 'Drop More Images (Auto-reset in 3s)';
            }
        }
    }, 1000);
    
    // Store interval ID for potential cleanup
    resetBtn.dataset.countdownInterval = countdownInterval;
}

function isMediaFile(fileName) {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return mediaExtensions.includes(ext);
}

function filterMediaFiles(files) {
    return files.filter(file => isMediaFile(file.name || file.path));
}

async function processImages(mediaFiles) {
    if (!mediaFiles || mediaFiles.length === 0) {
        alert('No media files found to process.');
        return;
    }
    
    // Check if we need a destination folder (only in move mode)
    if (processingMode === 'move' && !selectedDestinationFolder) {
        alert('Please select a destination folder first.');
        return;
    }
    
    showSection('processing');
    
    // Update processing text
    const processingText = document.querySelector('.processing p');
    processingText.textContent = `Processing ${mediaFiles.length} media file(s)...`;
    
    try {
        const imagePaths = mediaFiles.map(file => file.path);
        
        // Determine destination folder based on mode
        let destinationFolder;
        if (processingMode === 'inplace') {
            // Use null to signal in-place renaming
            destinationFolder = null;
        } else {
            destinationFolder = selectedDestinationFolder;
        }
        
        const response = await ipcRenderer.invoke('process-images', {
            imagePaths,
            destinationFolder,
            mode: processingMode,
            sortBy: sortByDate.checked ? 'date' : (sortByColor.checked ? 'color' : 'bitcoin'),
            sortIntoFolders: sortIntoFolders
        });
        
        if (response.success) {
            showResults(response.results);
        } else {
            alert(`Error processing images: ${response.error}`);
            showSection('ready');
        }
    } catch (error) {
        alert(`Unexpected error: ${error.message}`);
        showSection('ready');
    }
}

// Folder selection functionality
selectFolderBtn.addEventListener('click', async () => {
    const folder = await ipcRenderer.invoke('select-folder');
    if (folder) {
        selectedDestinationFolder = folder;
        folderPath.textContent = folder;
        selectedFolder.classList.remove('hidden');
        updateDropZoneState();
    }
});

changeFolderBtn.addEventListener('click', async () => {
    const folder = await ipcRenderer.invoke('select-folder');
    if (folder) {
        selectedDestinationFolder = folder;
        folderPath.textContent = folder;
        updateDropZoneState();
    }
});

// Drag and drop functionality
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (processingMode === 'inplace' || selectedDestinationFolder) {
        dropZone.classList.add('drag-over');
    }
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    // Check if we can process based on mode
    if (processingMode === 'move' && !selectedDestinationFolder) {
        alert('Please select a destination folder first.');
        return;
    }
    
    if (currentState === 'processing') {
        alert('Processing is already in progress. Please wait.');
        return;
    }
    
    // First try to get files the simple way (works for most cases)
    let files = Array.from(e.dataTransfer.files);
    const folders = [];
    
    // Check if we can detect folders (not all browsers support this)
    if (e.dataTransfer.items && e.dataTransfer.items[0] && 
        (e.dataTransfer.items[0].webkitGetAsEntry || e.dataTransfer.items[0].getAsEntry)) {
        
        // We can detect folders - let's separate files and folders
        files = [];
        const items = Array.from(e.dataTransfer.items);
        
        for (const item of items) {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : item.getAsEntry();
                if (entry) {
                    if (entry.isDirectory) {
                        // It's a folder
                        const file = item.getAsFile();
                        if (file && file.path) {
                            folders.push({ path: file.path, name: entry.name });
                        }
                    } else {
                        // It's a file
                        const file = item.getAsFile();
                        if (file) {
                            files.push(file);
                        }
                    }
                } else {
                    // Fallback - treat as file
                    const file = item.getAsFile();
                    if (file) {
                        files.push(file);
                    }
                }
            }
        }
    }
    
    // Handle folders if any were detected and extraction mode is enabled
    if (folders.length > 0 && extractFoldersMode) {
        const confirmExtract = confirm(
            `You dropped ${folders.length} folder(s).\n\n` +
            `Do you want to extract all files from these folders to their parent directory?\n\n` +
            `This will:\n` +
            `1. Move all files out of the folders\n` +
            `2. Delete the empty folders afterward\n\n` +
            `Folders: ${folders.map(f => f.name).join(', ')}`
        );
        
        if (confirmExtract) {
            showSection('processing');
            const processingText = document.querySelector('.processing p');
            processingText.textContent = `Extracting files from ${folders.length} folder(s)...`;
            
            try {
                const folderPaths = folders.map(f => f.path);
                const response = await ipcRenderer.invoke('extract-folders', { folderPaths });
                
                if (response.success) {
                    alert(
                        `Folder extraction complete!\n\n` +
                        `Files extracted: ${response.results.totalFilesExtracted}\n` +
                        `Empty folders deleted: ${response.results.totalFoldersDeleted}\n` +
                        (response.results.errors.length > 0 ? 
                            `\nErrors:\n${response.results.errors.join('\n')}` : '')
                    );
                    showSection('ready');
                } else {
                    alert(`Error extracting folders: ${response.error}`);
                    showSection('ready');
                }
            } catch (error) {
                alert(`Unexpected error: ${error.message}`);
                showSection('ready');
            }
            
            // If there were also files, ask if they should be processed
            if (files.length > 0) {
                const processFiles = confirm(`Also process ${files.length} individual file(s) that were dropped?`);
                if (!processFiles) {
                    return;
                }
            } else {
                return; // Only folders were dropped, we're done
            }
        }
    } else if (folders.length > 0 && !extractFoldersMode) {
        // Folders were dropped but extraction mode is disabled
        addTerminalLine(`📂 ${folders.length} folder(s) dropped - Enable "Folder extraction mode" to extract their contents`);
        
        // Still process any individual files that were dropped
        if (files.length === 0) {
            alert(`Folder extraction mode is disabled.\n\nTo extract folder contents, please enable "Folder extraction mode" first.\n\nAlternatively, drop individual image/video files to process them.`);
            return;
        }
    }
    
    // Process any individual files that were dropped
    if (files.length > 0) {
        // Filter only media files
        const mediaFiles = filterMediaFiles(files);
        
        if (mediaFiles.length === 0) {
            if (folders.length > 0) {
                alert('No individual media files found. The folders you dropped need extraction mode to be enabled.');
            } else {
                alert('No media files found. Please drop image or video files.');
            }
            return;
        }
        
        // Show confirmation if non-media files were dropped
        if (mediaFiles.length < files.length) {
            const nonMediaCount = files.length - mediaFiles.length;
            addTerminalLine(`📝 Found ${mediaFiles.length} media file(s) to process, ${nonMediaCount} non-media file(s) ignored`);
        }
        
        await processImages(mediaFiles);
    }
});

// Click handler for drop zone
dropZone.addEventListener('click', () => {
    if (processingMode === 'move' && !selectedDestinationFolder) {
        alert('Please select a destination folder first.');
        return;
    }
    
    if (currentState === 'processing') {
        alert('Processing is already in progress. Please wait.');
        return;
    }
    
    // For now, just show a message. In a full implementation, you might want to open a file dialog
    alert('Please drag and drop image files onto this area.');
});

// Reset functionality
resetBtn.addEventListener('click', () => {
    // Clear any active countdown
    if (resetBtn.dataset.countdownInterval) {
        clearInterval(parseInt(resetBtn.dataset.countdownInterval));
        resetBtn.dataset.countdownInterval = '';
    }
    
    resetBtn.textContent = 'Drop More Images (Auto-reset in 3s)';
    showSection('ready');
});

// Progress update listener
ipcRenderer.on('progress-update', (event, data) => {
    const processingText = document.querySelector('.processing p');
    if (data.processedFiles) {
        processingText.textContent = `Processing images... (${data.processedFiles} images processed)`;
    } else if (data.message) {
        processingText.textContent = data.message;
    }
});

// Terminal output functionality
function addTerminalLine(message, type = 'log') {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = message;
    terminalContent.appendChild(line);
    
    // Auto-scroll to bottom
    terminalContent.scrollTop = terminalContent.scrollHeight;
    
    // Limit to 500 lines
    while (terminalContent.children.length > 500) {
        terminalContent.removeChild(terminalContent.firstChild);
    }
}

// Clear terminal button
clearTerminal.addEventListener('click', () => {
    terminalContent.innerHTML = '';
    addTerminalLine('Terminal cleared', 'info');
});

// Listen for terminal output from main process
ipcRenderer.on('terminal-output', (event, data) => {
    addTerminalLine(data.message, data.type || 'log');
});

// Initialize the app
showSection('ready');
updateMode();
addTerminalLine('Bitcoin File Utility v2.0 initialized', 'success');