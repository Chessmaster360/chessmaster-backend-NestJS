// test-mongo.js - Script para probar la conexión a MongoDB
const mongoose = require('mongoose');

const uri = 'mongodb+srv://geoffreypv00_db_user:chess9563@chessdb.k4rayyg.mongodb.net/?appName=ChessDB';

console.log('🔍 Intentando conectar a MongoDB Atlas...');
console.log('🔍 URI (masked):', uri.replace(/:([^:@]+)@/, ':****@'));

mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000, // 10 segundos timeout
})
    .then(() => {
        console.log('✅ ¡Conexión exitosa a MongoDB Atlas!');
        mongoose.connection.close();
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Error de conexión:', err.message);
        console.error('📋 Detalles adicionales:');
        console.error('   - Reason:', err.reason);
        if (err.reason?.servers) {
            const servers = Object.entries(err.reason.servers);
            servers.forEach(([server, info]) => {
                console.error(`   - Server ${server}:`, info.error?.message || info);
            });
        }
        process.exit(1);
    });
