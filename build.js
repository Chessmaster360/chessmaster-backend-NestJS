const { exec, execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');

const STOCKFISH_VERSION = '17';
const STOCKFISH_LINUX_URL = `https://github.com/official-stockfish/Stockfish/releases/download/sf_${STOCKFISH_VERSION}/stockfish-ubuntu-x86-64-avx2.tar`;

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from: ${url}`);

    const makeRequest = (url) => {
      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          makeRequest(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded to: ${destPath}`);
          resolve();
        });
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

async function setupLinuxStockfish(destPath) {
  const tempDir = path.join(destPath, '_temp_stockfish');
  const tarPath = path.join(tempDir, 'stockfish.tar');
  const finalBinaryPath = path.join(destPath, 'stockfish');

  try {
    // Create temp directory
    fs.ensureDirSync(tempDir);

    // Download the tar file
    await downloadFile(STOCKFISH_LINUX_URL, tarPath);

    // Extract the tar file to temp directory
    console.log('📦 Extracting Stockfish...');
    execSync(`tar -xf stockfish.tar`, { cwd: tempDir });

    // Find the binary recursively
    console.log('🔍 Searching for Stockfish binary...');
    let foundBinary = null;

    function findBinary(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findBinary(fullPath);
        } else if (item.includes('stockfish') && item.includes('ubuntu') && !item.endsWith('.tar')) {
          foundBinary = fullPath;
          console.log(`✅ Found binary: ${fullPath}`);
        }
      }
    }

    findBinary(tempDir);

    if (!foundBinary) {
      throw new Error('Could not find Stockfish binary in extracted files');
    }

    // Remove existing stockfish directory/file if it exists
    if (fs.existsSync(finalBinaryPath)) {
      fs.removeSync(finalBinaryPath);
    }

    // Copy the binary
    fs.copyFileSync(foundBinary, finalBinaryPath);
    fs.chmodSync(finalBinaryPath, 0o755);
    console.log(`✅ Stockfish binary installed to: ${finalBinaryPath}`);

    // Cleanup temp directory
    fs.removeSync(tempDir);
    console.log('🧹 Cleaned up temp files');

  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
    console.error('❌ Error setting up Linux Stockfish:', error.message);
    throw error;
  }
}

async function build() {
  const isWindows = process.platform === 'win32';

  return new Promise((resolve, reject) => {
    exec('nest build', async (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Error en la compilación:', err);
        reject(err);
        return;
      }

      console.log(stdout);

      // Copy Stockfish files
      const srcPath = path.join(__dirname, 'src', 'engine', 'stockfish');
      const destPath = path.join(__dirname, 'dist', 'engine', 'stockfish');

      try {
        // Copy all stockfish files
        fs.ensureDirSync(destPath);
        fs.copySync(srcPath, destPath, { overwrite: true });
        console.log('✅ Stockfish files copied.');

        // On Linux, download the Linux binary
        if (!isWindows) {
          console.log('🐧 Linux detected, downloading Stockfish binary...');
          await setupLinuxStockfish(destPath);
        }

        console.log('✅ Build completed successfully.');
        resolve();
      } catch (copyErr) {
        console.error('❌ Error copying Stockfish:', copyErr);
        reject(copyErr);
      }
    });
  });
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
