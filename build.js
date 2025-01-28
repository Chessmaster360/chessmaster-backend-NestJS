const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

exec('nest build', (err, stdout, stderr) => {
  if (err) {
    console.error('❌ Error en la compilación:', err);
    return;
  }

  console.log(stdout);

  // Copiar Stockfish
  const srcPath = path.join(__dirname, 'src', 'engine', 'stockfish');
  const destPath = path.join(__dirname, 'dist', 'engine', 'stockfish');

  if (!fs.existsSync(destPath)) {
    fs.copySync(srcPath, destPath);
    console.log('✅ Stockfish copiado correctamente.');
  }

  console.log('✅ Build completado correctamente.');
});
