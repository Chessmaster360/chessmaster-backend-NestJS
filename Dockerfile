# Usa la imagen base de Node.js
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos de dependencia
COPY package*.json ./

# Instala TODAS las dependencias (incluidas las dev) para la construcción
RUN npm install

# Copia el resto del código
COPY . .

# Copia el binario de Stockfish al contenedor
COPY src/bin/stockfish.exe /usr/src/app/bin/stockfish

# Da permisos de ejecución al binario
RUN chmod +x /usr/src/app/bin/stockfish

# Compila el código fuente
RUN npm run build

# Expone el puerto 3000
EXPOSE 3000

# Ejecuta el código compilado en modo producción
CMD ["npm", "run", "start:prod"]
