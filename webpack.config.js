const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/engine/stockfish', to: 'dist/engine/stockfish' },
      ],
    }),
  ],
};
