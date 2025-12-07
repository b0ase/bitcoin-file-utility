const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const nodeCrypto = require('crypto');
const os = require('os');
const ExifParser = require('exif-parser');
const sharp = require('sharp');
const Vibrant = require('node-vibrant/node');
let bitcoin, ECPair, ecc;
try {
  bitcoin = require('bitcoinjs-lib');
  ECPair = require('ecpair');
  ecc = require('tiny-secp256k1');
} catch (error) {
  console.error('Error loading Bitcoin libraries:', error);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'File Utility',
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // Remove menu bar for cleaner look
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Media file extensions
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'];
const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv', '.3gp', '.mts', '.m2ts'];
const mediaExtensions = [...imageExtensions, ...videoExtensions];

// Helper function to move file to quarantine folder instead of trash
async function moveToQuarantine(filePath, reason = 'duplicate') {
  try {
    const fileName = path.basename(filePath);
    const quarantineDir = path.join(path.dirname(filePath), '_FileRenamer_Quarantine');
    
    // Create quarantine folder if it doesn't exist
    await fs.mkdir(quarantineDir, { recursive: true });
    
    // Generate unique name in quarantine to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const quarantinePath = path.join(quarantineDir, `${baseName}_${reason}_${timestamp}${ext}`);
    
    // Move file to quarantine (NOT delete)
    await fs.rename(filePath, quarantinePath);
    console.log(`Moved to quarantine: ${filePath} -> ${quarantinePath}`);
    
    // Create a recovery log
    const logPath = path.join(quarantineDir, 'recovery_log.txt');
    const logEntry = `${new Date().toISOString()} - Moved: ${filePath} -> ${quarantinePath} (Reason: ${reason})\n`;
    await fs.appendFile(logPath, logEntry);
    
    return true;
  } catch (error) {
    console.error(`Failed to quarantine file: ${filePath}`, error.message);
    return false;
  }
}

// Helper function to move file to system trash (kept for compatibility but not used by default)
async function moveToTrash(filePath) {
  try {
    const fileName = path.basename(filePath);
    const trashDir = path.join(os.homedir(), '.Trash');
    
    // Generate unique name in trash to avoid conflicts
    let trashPath = path.join(trashDir, fileName);
    let counter = 1;
    
    while (true) {
      try {
        await fs.access(trashPath);
        // File exists in trash, add counter
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        trashPath = path.join(trashDir, `${baseName}_${counter}${ext}`);
        counter++;
      } catch {
        // File doesn't exist in trash, we can use this name
        break;
      }
    }
    
    // Move file to trash
    await fs.rename(filePath, trashPath);
    console.log(`Moved to trash: ${filePath} -> ${trashPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to move file to trash: ${filePath}`, error.message);
    return false;
  }
}

// Helper function to get file SHA256 hash
async function getFileHash(filePath) {
  const timeout = 15000; // 15 seconds timeout
  
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.log(`Timeout hashing file: ${filePath}`);
      resolve(`timeout_file_${Date.now()}_${path.basename(filePath)}`);
    }, timeout);
    
    try {
      const stats = await fs.stat(filePath);
      
      // Skip very large files (over 100MB) to prevent hanging
      if (stats.size > 100 * 1024 * 1024) {
        console.log(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        clearTimeout(timer);
        resolve(`large_file_${stats.size}_${stats.mtime.getTime()}`);
        return;
      }
      
      // Skip hidden files
      const fileName = path.basename(filePath);
      if (fileName.startsWith('.')) {
        clearTimeout(timer);
        resolve(`hidden_file_${stats.size}_${stats.mtime.getTime()}`);
        return;
      }
      
      const fileBuffer = await fs.readFile(filePath);
      const hashSum = nodeCrypto.createHash('sha256'); // Changed to SHA256
      hashSum.update(fileBuffer);
      clearTimeout(timer);
      resolve(hashSum.digest('hex'));
    } catch (error) {
      console.error('Error hashing file:', filePath, error.message);
      clearTimeout(timer);
      // Return a unique identifier based on file path and stats
      try {
        const stats = await fs.stat(filePath);
        resolve(`error_file_${stats.size}_${stats.mtime.getTime()}_${path.basename(filePath)}`);
      } catch {
        resolve(`error_file_${Date.now()}_${path.basename(filePath)}`);
      }
    }
  });
}

// Helper function to check if file is media (image or video)
function isMediaFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mediaExtensions.includes(ext);
}

// Helper function to check if file is an image
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return imageExtensions.includes(ext);
}

// Helper function to check if file is a video
function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return videoExtensions.includes(ext);
}

// Helper function to extract original date from image metadata
async function getOriginalDateFromMetadata(filePath) {
  try {
    // First try to get EXIF data directly
    const buffer = await fs.readFile(filePath);
    
    // Try EXIF parser for JPEGs
    if (filePath.toLowerCase().match(/\.(jpg|jpeg)$/)) {
      try {
        const parser = ExifParser.create(buffer);
        const result = parser.parse();
        
        // Check for various date tags in order of preference
        if (result.tags) {
          // DateTimeOriginal is the most reliable for when photo was taken
          if (result.tags.DateTimeOriginal) {
            return new Date(result.tags.DateTimeOriginal * 1000);
          }
          // CreateDate is second best
          if (result.tags.CreateDate) {
            return new Date(result.tags.CreateDate * 1000);
          }
          // ModifyDate as fallback
          if (result.tags.ModifyDate) {
            return new Date(result.tags.ModifyDate * 1000);
          }
        }
      } catch (exifError) {
        console.log(`EXIF parsing failed for ${path.basename(filePath)}:`, exifError.message);
      }
    }
    
    // For other formats or if EXIF fails, try sharp metadata
    try {
      const metadata = await sharp(filePath).metadata();
      
      // Sharp can extract EXIF data too
      if (metadata.exif) {
        const exifData = await sharp(filePath)
          .withMetadata()
          .toBuffer({ resolveWithObject: true });
        
        // Try to parse EXIF from sharp
        if (exifData.info && exifData.info.exif) {
          try {
            const parser = ExifParser.create(exifData.info.exif);
            const result = parser.parse();
            if (result.tags && result.tags.DateTimeOriginal) {
              return new Date(result.tags.DateTimeOriginal * 1000);
            }
          } catch (e) {
            // Continue to file system dates
          }
        }
      }
    } catch (sharpError) {
      console.log(`Sharp metadata extraction failed for ${path.basename(filePath)}:`, sharpError.message);
    }
    
  } catch (error) {
    console.log(`Could not read metadata for ${path.basename(filePath)}:`, error.message);
  }
  
  // If no metadata date found, return null
  return null;
}

// Helper function to get formatted date from metadata or file stats
async function getFormattedDate(filePath, stats) {
  // First try to get date from metadata
  const metadataDate = await getOriginalDateFromMetadata(filePath);
  
  let date;
  if (metadataDate) {
    console.log(`Using metadata date for ${path.basename(filePath)}: ${metadataDate.toISOString()}`);
    date = metadataDate;
  } else {
    // Fall back to file system dates
    // Use birthtime (creation time) if available, otherwise use mtime (modification time)
    date = stats.birthtime || stats.mtime;
    console.log(`Using file system date for ${path.basename(filePath)}: ${date.toISOString()}`);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Helper function to generate Bitcoin address and private key
function generateBitcoinAddress() {
  try {
    // Check if libraries loaded successfully
    if (!bitcoin || !ECPair || !ecc) {
      throw new Error('Bitcoin libraries not loaded');
    }
    
    // Initialize ECPair library with secp256k1 curve
    const ECPairFactory = ECPair.ECPairFactory(ecc);
    
    // Generate a random private key for mainnet
    const keyPair = ECPairFactory.makeRandom({ network: bitcoin.networks.bitcoin });
    
    // Get the private key in WIF (Wallet Import Format)
    const privateKey = keyPair.toWIF();
    
    // Generate the Legacy (P2PKH) address that starts with "1"
    // P2PKH = Pay to Public Key Hash (the original Bitcoin address format)
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin // Explicitly use mainnet to ensure addresses start with "1"
    });
    
    return {
      address: address,
      privateKey: privateKey
    };
  } catch (error) {
    console.error('Error generating Bitcoin address:', error);
    // Generate a fallback random string if Bitcoin generation fails
    const randomBytes = nodeCrypto.randomBytes(20);
    const fallbackAddress = '1' + randomBytes.toString('hex').substring(0, 33);
    return {
      address: fallbackAddress,
      privateKey: 'ERROR_GENERATING_KEY'
    };
  }
}

// Helper function to get date folder name (YYYY-MM-DD)
async function getDateFolderName(filePath, stats) {
  // First try to get date from metadata
  const metadataDate = await getOriginalDateFromMetadata(filePath);
  
  let date;
  if (metadataDate) {
    date = metadataDate;
  } else {
    // Fall back to file system dates
    date = stats.birthtime || stats.mtime;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Helper function to extract dominant color from media
async function getDominantColor(filePath) {
  // Check if it's a video file
  if (isVideoFile(filePath)) {
    console.log(`Video color sorting coming soon for: ${path.basename(filePath)}`);
    if (mainWindow) {
      mainWindow.webContents.send('terminal-output', {
        message: `⚠️ Video color sorting coming soon for: ${path.basename(filePath)}`,
        type: 'info'
      });
    }
    return null; // Skip color extraction for videos for now
  }
  
  try {
    const palette = await Vibrant.from(filePath).getPalette();
    
    // Get the dominant color
    const dominantSwatch = palette.Vibrant || palette.DarkVibrant || palette.Muted || palette.DarkMuted || palette.LightVibrant;
    
    if (dominantSwatch) {
      const rgb = dominantSwatch.getRgb();
      // Convert RGB to HSL for better sorting
      const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      
      // Log to console and send to renderer
      const colorInfo = `Color: H:${Math.round(hsl[0])}° S:${Math.round(hsl[1])}% L:${Math.round(hsl[2])}%`;
      console.log(`Analyzed ${path.basename(filePath)} - ${colorInfo}`);
      
      if (mainWindow) {
        mainWindow.webContents.send('terminal-output', {
          message: `Analyzed ${path.basename(filePath)} - ${colorInfo}`,
          type: 'info'
        });
      }
      
      return {
        hue: hsl[0],
        saturation: hsl[1],
        lightness: hsl[2],
        rgb: rgb
      };
    }
  } catch (error) {
    console.error(`Failed to extract color from ${path.basename(filePath)}:`, error.message);
    if (mainWindow) {
      mainWindow.webContents.send('terminal-output', {
        message: `Failed to extract color from ${path.basename(filePath)}: ${error.message}`,
        type: 'error'
      });
    }
  }
  
  return null;
}

// Helper function to convert RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return [h * 360, s * 100, l * 100];
}

// Override console.log to send to renderer
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('terminal-output', {
      message: args.join(' '),
      type: 'log'
    });
  }
};

// Override console.error to send to renderer
const originalError = console.error;
console.error = function(...args) {
  originalError.apply(console, args);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('terminal-output', {
      message: args.join(' '),
      type: 'error'
    });
  }
};

// Helper function to get all existing images in destination folder with their hashes
async function getExistingImages(destinationFolder) {
  const existingImages = {};
  
  try {
    const files = await fs.readdir(destinationFolder);
    let processedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(destinationFolder, file);
      try {
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && isMediaFile(filePath)) {
          processedCount++;
          if (processedCount % 5 === 0) {
            mainWindow.webContents.send('progress-update', { 
              message: `Scanning existing images... (${processedCount} processed)` 
            });
          }
          
          const hash = await getFileHash(filePath);
          existingImages[hash] = {
            path: filePath,
            name: file,
            stats: stats
          };
        }
      } catch (error) {
        console.error(`Error processing existing file: ${filePath}`, error.message);
      }
    }
  } catch (error) {
    console.error('Error reading destination folder:', error.message);
  }
  
  return existingImages;
}

// Generate unique filename in destination folder
async function generateUniqueFilename(destinationFolder, baseName, extension) {
  let counter = 0;
  let fileName = `${baseName}${extension}`;
  let filePath = path.join(destinationFolder, fileName);
  
  while (true) {
    try {
      await fs.access(filePath);
      // File exists, try with counter
      counter++;
      fileName = `${baseName}_${counter}${extension}`;
      filePath = path.join(destinationFolder, fileName);
    } catch {
      // File doesn't exist, we can use this name
      break;
    }
  }
  
  return { fileName, filePath };
}

// Track processing state to prevent multiple simultaneous operations
let isProcessing = false;

// Main image processing function
ipcMain.handle('process-images', async (event, { imagePaths, destinationFolder, mode, sortBy, sortIntoFolders }) => {
  if (isProcessing) {
    return { success: false, error: 'Another operation is already in progress. Please wait.' };
  }
  
  isProcessing = true;
  
  try {
    const results = {
      totalFiles: 0,
      duplicatesMovedToTrash: 0,
      filesRenamed: 0,
      errors: [],
      skippedFiles: 0,
      quarantinedFiles: [] // Track quarantined files
    };

    // In-place mode handling
    const isInPlaceMode = mode === 'inplace' || !destinationFolder;
    
    // Validate destination folder (only for move mode)
    if (!isInPlaceMode) {
      try {
        const stats = await fs.stat(destinationFolder);
        if (!stats.isDirectory()) {
          return { success: false, error: 'Destination path is not a directory.' };
        }
      } catch (error) {
        return { success: false, error: 'Destination folder does not exist or is not accessible.' };
      }
    }

    // Filter only media files (images and videos)
    const mediaFiles = imagePaths.filter(isMediaFile);
    
    if (mediaFiles.length === 0) {
      return { success: false, error: 'No valid media files (images or videos) found.' };
    }

    results.totalFiles = mediaFiles.length;

    // Get existing images in destination folder (skip for in-place mode)
    let existingImages = {};
    if (!isInPlaceMode) {
      event.sender.send('progress-update', { message: 'Scanning destination folder...' });
      existingImages = await getExistingImages(destinationFolder);
    }

    // First pass: collect all files with their metadata
    const filesWithMetadata = [];
    const useColorSort = sortBy === 'color';
    
    if (useColorSort) {
      event.sender.send('progress-update', { message: 'Analyzing image colors...' });
    }
    
    for (const imagePath of mediaFiles) {
      try {
        const stats = await fs.stat(imagePath);
        let fileData = {
          path: imagePath,
          stats: stats
        };
        
        if (useColorSort) {
          // Extract dominant color for sorting
          const colorData = await getDominantColor(imagePath);
          if (colorData) {
            fileData.color = colorData;
            fileData.sortValue = colorData.hue; // Sort by hue
          } else {
            fileData.sortValue = 999; // Put failed color extractions at the end
          }
        } else {
          // Use date for sorting
          const metadataDate = await getOriginalDateFromMetadata(imagePath);
          const effectiveDate = metadataDate || stats.birthtime || stats.mtime;
          fileData.date = effectiveDate;
          fileData.timestamp = effectiveDate.getTime();
          fileData.sortValue = fileData.timestamp;
        }
        
        filesWithMetadata.push(fileData);
      } catch (error) {
        console.error(`Error reading file ${imagePath}:`, error);
        results.errors.push(`Failed to read ${path.basename(imagePath)}: ${error.message}`);
      }
    }
    
    // Sort files by the selected criteria
    filesWithMetadata.sort((a, b) => a.sortValue - b.sortValue);
    
    if (useColorSort) {
      console.log(`Sorted ${filesWithMetadata.length} files by dominant color (hue)`);
    } else {
      console.log(`Sorted ${filesWithMetadata.length} files by metadata/creation date`);
    }

    // Process each image in sorted order
    const processedHashes = new Set(); // Track hashes we've processed in this batch
    let processedCount = 0;

    for (const fileInfo of filesWithMetadata) {
      processedCount++;
      const imagePath = fileInfo.path;
      const stats = fileInfo.stats;
      
      event.sender.send('progress-update', { 
        processedFiles: processedCount,
        message: `Processing image ${processedCount} of ${filesWithMetadata.length}...` 
      });

      try {
        if (!stats.isFile()) {
          results.errors.push(`Skipped non-file: ${path.basename(imagePath)}`);
          continue;
        }

        // Get SHA256 hash of the image
        const hash = await getFileHash(imagePath);
        console.log(`Processing: ${path.basename(imagePath)} (hash: ${hash.substring(0, 8)}...)`);
        
        // Check if this hash already exists in destination folder
        if (existingImages[hash]) {
          // Check if it's the same file (same path) - not a duplicate, just renaming in place
          const existingFilePath = path.resolve(existingImages[hash].path);
          const sourceFilePath = path.resolve(imagePath);
          
          if (existingFilePath === sourceFilePath) {
            console.log(`✓ SAME FILE: ${path.basename(imagePath)} - will rename in place`);
            // Continue processing - this is the same file being renamed, not a duplicate
          } else {
            console.log(`✗ DUPLICATE FOUND: ${path.basename(imagePath)} matches existing ${existingImages[hash].name}`);
            results.duplicatesMovedToTrash++;
            try {
              // Move duplicate to quarantine folder for safety (not trash, not deleted)
              const moved = await moveToQuarantine(imagePath, 'duplicate');
              if (moved) {
                console.log(`  ✓ MOVED TO QUARANTINE: ${path.basename(imagePath)}`);
                results.quarantinedFiles.push(path.basename(imagePath));
              } else {
                throw new Error('Failed to move to quarantine');
              }
            } catch (quarantineError) {
              console.error(`  ✗ FAILED to quarantine ${path.basename(imagePath)}:`, quarantineError.message);
              results.errors.push(`Failed to quarantine duplicate: ${path.basename(imagePath)}`);
            }
            continue;
          }
        }

        // Check if we've already processed this hash in this batch
        // But track by both hash and path to avoid treating same file as duplicate
        const processedKey = `${hash}|${path.resolve(imagePath)}`;
        if (processedHashes.has(hash)) {
          // Check if it's actually the same file path we've seen before
          let isSameFile = false;
          for (const key of processedHashes) {
            if (key.startsWith(hash + '|')) {
              const [, processedPath] = key.split('|');
              if (processedPath === path.resolve(imagePath)) {
                isSameFile = true;
                break;
              }
            }
          }
          
          if (!isSameFile) {
            console.log(`✗ DUPLICATE IN BATCH: ${path.basename(imagePath)} has same hash as earlier image`);
            results.duplicatesMovedToTrash++;
            try {
              // Move duplicate to quarantine folder for safety
              const moved = await moveToQuarantine(imagePath, 'batch_duplicate');
              if (moved) {
                console.log(`  ✓ MOVED TO QUARANTINE: ${path.basename(imagePath)}`);
                results.quarantinedFiles.push(path.basename(imagePath));
              } else {
                throw new Error('Failed to move to quarantine');
              }
            } catch (quarantineError) {
              console.error(`  ✗ FAILED to quarantine ${path.basename(imagePath)}:`, quarantineError.message);
              results.errors.push(`Failed to quarantine duplicate: ${path.basename(imagePath)}`);
            }
            continue;
          }
        }

        // This is a unique image - rename or move it
        let baseNameStr;
        let bitcoinKeys = null;
        
        if (sortBy === 'bitcoin') {
          // Generate Bitcoin address for this file
          console.log('Generating Bitcoin address for file:', path.basename(imagePath));
          bitcoinKeys = generateBitcoinAddress();
          baseNameStr = bitcoinKeys.address;
          console.log('Generated Bitcoin address:', baseNameStr);
        } else {
          // Use date-based naming
          baseNameStr = await getFormattedDate(imagePath, stats);
        }
        
        const originalExt = path.extname(imagePath);
        
        let fileName, filePath;
        
        if (isInPlaceMode) {
          // In-place mode: rename in the same directory or sort into date folders
          let targetDir = path.dirname(imagePath);
          
          if (sortIntoFolders) {
            const dateFolderName = await getDateFolderName(imagePath, stats);
            targetDir = path.join(path.dirname(imagePath), dateFolderName);
            
            // Create the date folder if it doesn't exist
            try {
              await fs.mkdir(targetDir, { recursive: true });
            } catch (error) {
              console.error(`Failed to create folder ${targetDir}:`, error);
              results.errors.push(`Failed to create folder for ${path.basename(imagePath)}`);
              continue;
            }
          }
          
          const result = await generateUniqueFilename(targetDir, baseNameStr, originalExt);
          fileName = result.fileName;
          filePath = result.filePath;
          
          // Rename/move file
          await fs.rename(imagePath, filePath);
          console.log(`✓ Renamed in-place: ${path.basename(imagePath)} → ${fileName}`);
        } else {
          // Move mode: use destination folder, optionally with date subfolder
          let targetFolder = destinationFolder;
          
          if (sortIntoFolders) {
            const dateFolderName = await getDateFolderName(imagePath, stats);
            targetFolder = path.join(destinationFolder, dateFolderName);
            
            // Create the date folder if it doesn't exist
            try {
              await fs.mkdir(targetFolder, { recursive: true });
            } catch (error) {
              console.error(`Failed to create folder ${targetFolder}:`, error);
              results.errors.push(`Failed to create folder for ${path.basename(imagePath)}`);
              continue;
            }
          }
          
          const result = await generateUniqueFilename(targetFolder, baseNameStr, originalExt);
          fileName = result.fileName;
          filePath = result.filePath;
          
          // Check if the source file is already in the destination folder
          const sourceDir = path.dirname(imagePath);
          const isSameFolder = path.resolve(sourceDir) === path.resolve(targetFolder);
          
          if (isSameFolder) {
            // If it's in the same folder, just rename it
            await fs.rename(imagePath, filePath);
            console.log(`✓ Renamed: ${path.basename(imagePath)} → ${fileName}`);
            
            // Remove the old entry from existingImages since we've renamed the file
            // This prevents issues if processing multiple files from the same folder
            for (const [existingHash, existingFile] of Object.entries(existingImages)) {
              if (path.resolve(existingFile.path) === path.resolve(imagePath)) {
                delete existingImages[existingHash];
                break;
              }
            }
          } else {
            // Safer move: verify copy before deleting original
            try {
              // Step 1: Copy file to destination
              await fs.copyFile(imagePath, filePath);
              
              // Step 2: Verify the copy exists and has the same size
              const sourceStats = await fs.stat(imagePath);
              const destStats = await fs.stat(filePath);
              
              if (destStats.size !== sourceStats.size) {
                throw new Error('Copy verification failed: file sizes do not match');
              }
              
              // Step 3: Only delete original after successful verification
              await fs.unlink(imagePath);
              console.log(`✓ Safely moved: ${path.basename(imagePath)} → ${fileName} (verified copy)`);
            } catch (moveError) {
              // If anything fails, try to clean up the partial copy
              try {
                await fs.unlink(filePath);
              } catch {}
              throw moveError;
            }
          }
        }
        
        // If using Bitcoin naming, create a private key file
        if (bitcoinKeys) {
          const privateKeyFileName = `${bitcoinKeys.address}_private_key.txt`;
          const privateKeyPath = path.join(path.dirname(filePath), privateKeyFileName);
          
          // Create the private key file with the private key content
          const privateKeyContent = `Bitcoin Private Key for ${bitcoinKeys.address}\n\n` +
                                   `Private Key (WIF): ${bitcoinKeys.privateKey}\n\n` +
                                   `WARNING: Keep this file secure! Anyone with this private key can access the Bitcoin address.\n` +
                                   `Address: ${bitcoinKeys.address}\n` +
                                   `Associated File: ${fileName}`;
          
          try {
            await fs.writeFile(privateKeyPath, privateKeyContent, 'utf8');
            console.log(`✓ Created private key file: ${privateKeyFileName}`);
          } catch (error) {
            console.error(`Failed to create private key file: ${error.message}`);
            results.errors.push(`Failed to create private key file for ${fileName}`);
          }
        }
        
        // Mark this hash and path as processed
        processedHashes.add(processedKey);
        
        results.filesRenamed++;

      } catch (error) {
        results.errors.push(`Failed to process ${path.basename(imagePath)}: ${error.message}`);
        console.error(`Error processing ${imagePath}:`, error);
      }
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    isProcessing = false;
  }
});

// Helper function to extract all files from folders to parent directory
async function extractFolderContents(folderPath) {
  const results = {
    filesExtracted: 0,
    foldersDeleted: 0,
    errors: []
  };
  
  try {
    const parentDir = path.dirname(folderPath);
    const folderName = path.basename(folderPath);
    
    console.log(`Extracting contents from folder: ${folderName}`);
    
    // Recursively get all files in the folder
    async function getAllFiles(dir, fileList = []) {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          // Recursively get files from subdirectories
          await getAllFiles(filePath, fileList);
        } else {
          fileList.push(filePath);
        }
      }
      
      return fileList;
    }
    
    // Get all files in the folder
    const allFiles = await getAllFiles(folderPath);
    
    if (allFiles.length === 0) {
      console.log(`Folder ${folderName} is already empty`);
      return results;
    }
    
    console.log(`Found ${allFiles.length} files to extract from ${folderName}`);
    
    // Move each file to parent directory
    for (const filePath of allFiles) {
      try {
        const fileName = path.basename(filePath);
        const relativePath = path.relative(folderPath, filePath);
        
        // Generate unique filename in parent directory
        let destPath = path.join(parentDir, fileName);
        let counter = 1;
        
        // Handle naming conflicts
        while (true) {
          try {
            await fs.access(destPath);
            // File exists, add counter
            const ext = path.extname(fileName);
            const baseName = path.basename(fileName, ext);
            destPath = path.join(parentDir, `${baseName}_extracted_${counter}${ext}`);
            counter++;
          } catch {
            // File doesn't exist, we can use this name
            break;
          }
        }
        
        // Move file to parent directory
        await fs.rename(filePath, destPath);
        console.log(`Extracted: ${relativePath} → ${path.basename(destPath)}`);
        results.filesExtracted++;
        
      } catch (error) {
        console.error(`Failed to extract ${filePath}: ${error.message}`);
        results.errors.push(`Failed to extract ${path.basename(filePath)}: ${error.message}`);
      }
    }
    
    // Now safely delete empty directories
    async function deleteEmptyDirs(dir) {
      const files = await fs.readdir(dir);
      
      // First, recursively delete empty subdirectories
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          await deleteEmptyDirs(filePath);
        }
      }
      
      // Check if directory is now empty
      const remainingFiles = await fs.readdir(dir);
      
      if (remainingFiles.length === 0) {
        // Double-check it's really empty before deleting
        console.log(`Deleting empty folder: ${path.basename(dir)}`);
        await fs.rmdir(dir);
        results.foldersDeleted++;
      } else {
        console.log(`Folder ${path.basename(dir)} still contains ${remainingFiles.length} items - not deleting`);
      }
    }
    
    // Delete the now-empty folder structure
    await deleteEmptyDirs(folderPath);
    
    return results;
    
  } catch (error) {
    console.error(`Error extracting folder contents: ${error.message}`);
    results.errors.push(`Failed to process folder: ${error.message}`);
    return results;
  }
}

// Handle folder extraction
ipcMain.handle('extract-folders', async (event, { folderPaths }) => {
  const overallResults = {
    totalFilesExtracted: 0,
    totalFoldersDeleted: 0,
    errors: []
  };
  
  for (const folderPath of folderPaths) {
    const results = await extractFolderContents(folderPath);
    overallResults.totalFilesExtracted += results.filesExtracted;
    overallResults.totalFoldersDeleted += results.foldersDeleted;
    overallResults.errors.push(...results.errors);
  }
  
  return { success: true, results: overallResults };
});

// Handle folder selection dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select destination folder for renamed images'
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});