# ⚡ Bitcoin File Utility ⚡

A powerful cyber-tech themed desktop utility that processes image sequences with advanced SHA256 duplicate detection, safety features, and a sleek optimized interface.

## 🌟 Features

- 🖼️ **Advanced Image Processing**: Specifically designed for image files (JPG, JPEG, PNG, GIF, BMP, TIFF, TIF, WEBP)
- 🗂️ **Smart Destination Control**: Choose where to save your processed images
- 🖱️ **Enhanced Drag & Drop**: Seamless workflow with auto-reset and continuous processing
- 📅 **Date-based Renaming**: Images renamed using format `YYYY-MM-DD_HH-MM-SS` based on creation date
- 🔒 **SHA256 Duplicate Detection**: Automatically detects duplicates using secure SHA256 hashing
- 🗑️ **Safe Duplicate Handling**: Duplicates moved to system trash (not permanently deleted)
- 🎯 **Smart Folder Detection**: Files already in destination folder are renamed instead of moved
- 📊 **Real-time Progress Tracking**: Live statistics with space-optimized cyberpunk UI
- ⚡ **Seamless Workflow**: Auto-reset timer allows continuous batch processing
- 🎨 **Space-Optimized Interface**: Compact design maximizing screen real estate
- 🖥️ **Cross-platform**: Works on macOS, Windows, and Linux
- 📦 **Distribution Ready**: Pre-built macOS app available

## 🚀 How it Works

1. **Select Destination Folder**: Choose where to save your processed images
2. **Drop Images**: Drag image files into the glowing drop zone
3. **Automatic Processing**: Bitcoin File Utility intelligently processes each image:
   - Calculates SHA256 hash for duplicate detection
   - Checks against existing images in destination folder
   - **Safe Duplicate Handling**: Moves duplicates to system trash (recoverable)
   - **Smart Renaming**: Files in destination folder get unique names
   - Renames using creation/modification date format
   - Moves unique images to destination safely
4. **View Results**: See detailed statistics in the cyber-styled results panel
5. **Continuous Processing**: Auto-reset allows immediate processing of more images

## 🛡️ Safety Features

- **🗑️ Trash Recovery**: Duplicates moved to system trash, not permanently deleted
- **📁 Smart Folder Handling**: Files already in destination get renamed, not overwritten
- **🔍 Advanced Duplicate Detection**: SHA256 comparison prevents false duplicates
- **⚡ Progress Tracking**: Real-time feedback during processing
- **🔒 Local Processing**: All operations performed locally on your machine

## 🎨 Interface Improvements

**Space-Optimized Design:**
- Compact header and reduced padding for better space usage
- Horizontal folder selector layout
- CSS Grid-based statistics display
- Larger container with scroll support
- Enhanced mobile responsiveness

**Cyber-Tech Aesthetic:**
- **Dark Background**: Deep black with gradient overlays
- **Neon Accents**: Matrix-green (#00ff41) and cyan (#00bfff) highlights
- **Animated Effects**: Glowing borders and pulsing text
- **Monospace Font**: Courier New for that terminal feel
- **Futuristic Elements**: Sharp edges and tech-inspired design

## 🔧 Installation & Usage

### Option 1: Use Pre-built App (macOS)
Download the latest `Bitcoin File Utility-1.0.0-arm64.dmg` from releases.

#### ⚠️ macOS Security Notice
Since this app isn't code-signed with an Apple Developer certificate, macOS will show a security warning. To bypass this:

1. **First method:** Right-click the app and select "Open" instead of double-clicking
2. **If blocked:** Go to System Settings → Privacy & Security → click "Open Anyway"
3. **Terminal method:** Run `xattr -cr "/Applications/Bitcoin File Utility.app"`

This is a one-time setup. The app is safe and open source.

### Option 2: Build from Source

#### Prerequisites
- Node.js (v14 or later)
- npm

#### Setup
```bash
# Clone the repository
git clone https://github.com/b0ase/bitcoin-file-utility.git
cd bitcoin-file-utility

# Install dependencies
npm install

# Run the application
npm start
```

#### Building Executables
```bash
# Build for current platform
npm run build

# The built app will be in the dist/ folder
```

**Note:** The built app won't be code-signed. To sign it, you need:
- An Apple Developer account ($99/year)
- Configure electron-builder with your signing certificate
- Or users can follow the security bypass instructions above

## 📊 File Processing Details

- **Supported Formats**: JPG, JPEG, PNG, GIF, BMP, TIFF, TIF, WEBP
- **Duplicate Detection**: SHA256 checksum comparison with 15-second timeout protection
- **Naming Convention**: `YYYY-MM-DD_HH-MM-SS` based on file creation/modification date
- **Large File Handling**: Files over 100MB are processed with size-based hashing
- **Safety**: Duplicates moved to trash, unique files moved to destination
- **Smart Renaming**: Automatic unique naming prevents file conflicts

## 🎯 Enhanced Workflow

- **Auto-Reset Timer**: 3-second countdown automatically resets for next batch
- **Continuous Processing**: Drop more images while viewing results
- **Batch Statistics**: Real-time tracking of processed, duplicates, and errors
- **Error Recovery**: Comprehensive error handling and reporting
- **Progress Updates**: Live feedback during scanning and processing

## 🛡️ Security & Privacy

- **Local Processing**: All operations performed locally on your machine
- **No Data Collection**: Bitcoin File Utility doesn't collect or transmit any data
- **SHA256 Hashing**: Cryptographically secure hashing for duplicate detection
- **File Safety**: Duplicates moved to recoverable system trash
- **Integrity Protection**: Original files safely moved, never lost

## 🎯 Use Cases

- **Photo Organization**: Organize camera dumps by date with duplicate protection
- **Safe Duplicate Removal**: Clean up collections with recoverable trash system
- **Batch Processing**: Process hundreds of images with continuous workflow
- **Archive Management**: Maintain clean image archives with smart renaming
- **Content Creation**: Organize assets for projects with safety features

## 📝 Recent Updates

- ✅ Enhanced workflow with auto-reset functionality
- ✅ Space-optimized UI design (40% reduction in vertical space)
- ✅ Safety features: duplicates moved to trash instead of deletion
- ✅ Smart folder detection and conflict resolution
- ✅ Improved error handling and progress tracking
- ✅ Built distribution for macOS (DMG available)

## 📝 License

MIT License - feel free to modify and distribute.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Bitcoin File Utility** - Where cyberpunk meets functionality and safety. ⚡ 