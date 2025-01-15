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

# Compila el código fuente
RUN npm run build

# Expone el puerto 3000
EXPOSE 3000

# Copia el archivo .env al contenedor
COPY .env .env

# Ejecuta el código compilado en modo producción
CMD ["npm", "run", "start:prod"]
