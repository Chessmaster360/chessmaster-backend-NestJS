# Usa la imagen base de Node.js
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos de dependencia
COPY package*.json ./

# Instala las dependencias
RUN npm install --only=production

# Copia el resto del código
COPY . .

# Compila el código fuente
RUN npm run build

# Expone el puerto 3000
EXPOSE 3000

# Ejecuta el código compilado en modo producción
CMD ["npm", "run", "start:prod"]
