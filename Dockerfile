# Dockerfile
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia el package.json e instala las dependencias
COPY package*.json ./
RUN npm install

# Copia el código fuente
COPY . .

# Compila el código
RUN npm run build

# Expone el puerto 3000
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["npm", "run", "start:prod"]
