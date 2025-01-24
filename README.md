# **Chessmaster 360 - Backend**

Este proyecto es el backend de la plataforma **Chessmaster 360**, una solución integral para entusiastas del ajedrez que buscan analizar partidas, competir en torneos, y aprender mediante herramientas interactivas. Este backend está desarrollado utilizando **NestJS** y ofrece soporte para las funcionalidades clave de la plataforma.

---

## **Contexto**

El ajedrez es un juego estratégico que ha ganado popularidad gracias al acceso digital a recursos educativos y partidas en línea. Sin embargo, muchas plataformas actuales carecen de funcionalidades avanzadas como análisis profundo de partidas o una comunidad colaborativa.

Chessmaster 360 busca abordar estas necesidades al proporcionar:

- Análisis avanzado de partidas usando motores de análisis como **Stockfish**.
- Funcionalidades de aprendizaje interactivo.
- Competencia en torneos con clasificación en tiempo real.
- Una comunidad global para el intercambio de estrategias y experiencias.

---

## **Características del backend**

El backend de **Chessmaster 360** ofrece:

- **Registro y autenticación:** Soporte para autenticación mediante correo y proveedores externos como Google.
- **Análisis de partidas:** Integración con el motor de análisis **Stockfish** para procesar partidas y proporcionar recomendaciones.
- **Estadísticas de jugador:** Seguimiento de partidas, logros y progreso en tiempo real.
- **Gestión de torneos:** Creación y administración de torneos, incluyendo reglas y clasificaciones.
- **Soporte para comunidad:** APIs para foros, chats y reportes de comportamiento.
- **Eficiencia:** Uso de `Worker Threads` en Node.js para manejar procesos pesados, como el análisis de partidas.

---

## **Estructura del proyecto**

La estructura principal del backend está organizada de la siguiente manera:

```
chessmaster-360-backend/
├── src/
│   ├── app.module.ts               # Módulo principal de la aplicación.
│   ├── auth/                       # Módulo de autenticación y autorización.
│   ├── user/                       # Gestión de usuarios y perfiles.
│   ├── game-analysis/              # Análisis de partidas de ajedrez (con Stockfish).
│   ├── tournament/                 # Gestión de torneos.
│   ├── community/                  # Funcionalidades de foros y chats.
│   ├── shared/                     # Componentes y utilidades compartidas.
│   ├── main.ts                     # Archivo de entrada de la aplicación.
├── dist/                           # Archivos generados tras la compilación.
├── package.json                    # Configuración del proyecto.
├── tsconfig.json                   # Configuración de TypeScript.
└── README.md                       # Documentación del proyecto.
```

---

## **Objetivo del backend**

El backend está diseñado para:

- Procesar solicitudes de la interfaz frontend y devolver respuestas rápidas y precisas.
- Manejar múltiples usuarios concurrentes sin afectar el rendimiento.
- Permitir extensibilidad para futuras funcionalidades, como lecciones interactivas o una biblioteca de aperturas.

---

## **Tecnologías empleadas**

Este backend utiliza las siguientes tecnologías clave:

- **NestJS:** Framework para estructurar la aplicación de forma modular y escalable.
- **Node.js:** Plataforma para ejecutar JavaScript en el servidor.
- **TypeScript:** Superset de JavaScript con tipado estático.
- **MongoDB:** Base de datos NoSQL para almacenar usuarios, partidas, estadísticas y configuraciones.
- **Stockfish:** Motor de análisis de ajedrez utilizado para evaluar partidas.
- **Docker:** Contenedores para desplegar y gestionar el backend de forma eficiente.
- **OAuth 2.0:** Protocolo de autenticación para inicio de sesión con Google y otros proveedores.

---

## **Configuración e instalación**

1. Clona este repositorio:

   ```bash
   git clone https://github.com/tu_usuario/chessmaster-360-backend.git
   cd chessmaster-360-backend
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Configura las variables de entorno en un archivo `.env`. Ejemplo:

   ```env
   MONGO_URI=mongodb://localhost:27017/chessmaster
   JWT_SECRET=tu_secreto_jwt
   ```

4. Compila y ejecuta el servidor:
   ```bash
   npm run build
   npm start
   ```

---

## **Ejecución con Docker**

Si prefieres usar Docker, puedes ejecutar el backend fácilmente:

1. Construye la imagen Docker:

   ```bash
   docker build -t chessmaster-backend .
   ```

2. Ejecuta el contenedor:

   ```bash
   docker run -p 3000:3000 --env-file .env chessmaster-backend
   ```

3. Accede al backend en `http://localhost:3000`.

---

## **Licencia**

Este proyecto está bajo la licencia [MIT](LICENSE).

Si tienes preguntas, no dudes en contactarnos o abrir un issue en el repositorio. ¡Gracias por usar Chessmaster 360! ♟️

---
