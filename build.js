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
  const tarPath = path.join(destPath, 'stockfish.tar');

  try {
    // Download the tar file
    await downloadFile(STOCKFISH_LINUX_URL, tarPath);

    // Extract the tar file
    console.log('📦 Extracting Stockfish...');
    execSync(`tar -xf stockfish.tar`, { cwd: destPath });

    // Find and move the binary
    const extractedDir = path.join(destPath, `stockfish`);
    const binaryPath = path.join(extractedDir, 'stockfish-ubuntu-x86-64-avx2');
    const finalPath = path.join(destPath, 'stockfish');

    if (fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, finalPath);
      fs.chmodSync(finalPath, 0o755);
      console.log('✅ Stockfish Linux binary ready');
    } else {
      // Try alternative path structure
      const files = fs.readdirSync(destPath);
      console.log('📁 Files in dest:', files);

      for (const file of files) {
        const fullPath = path.join(destPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          const innerFiles = fs.readdirSync(fullPath);
          for (const inner of innerFiles) {
            if (inner.includes('stockfish') && !inner.includes('.')) {
              const srcBin = path.join(fullPath, inner);
              fs.copyFileSync(srcBin, finalPath);
              fs.chmodSync(finalPath, 0o755);
              console.log(`✅ Found and copied: ${inner}`);
              break;
            }
          }
        }
      }
    }

    // Cleanup
    fs.removeSync(tarPath);
    if (fs.existsSync(extractedDir)) {
      fs.removeSync(extractedDir);
    }

  } catch (error) {
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
        fs.copySync(srcPath, destPath);
        console.log('✅ Stockfish files copied.');

        // On Linux, download the Linux binary
        if (!isWindows) {
          const linuxBinaryPath = path.join(destPath, 'stockfish');
          if (!fs.existsSync(linuxBinaryPath)) {
            console.log('🐧 Linux detected, downloading Stockfish binary...');
            await setupLinuxStockfish(destPath);
          }
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
