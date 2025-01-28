const { exec } = require('child_process');
const fs = require('fs-extra');

// Step 1: Run NestJS build
exec('nest build', (err, stdout, stderr) => {
  if (err) {
    console.error('Build failed:', err);
    return;
  }

  console.log(stdout);

  // Step 2: Copy required files
  fs.copySync('src/engine/stockfish', 'dist/src/engine/stockfish');

  console.log('Build completed successfully!');
});