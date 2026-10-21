# VerHentai Addon para Nuvio & Stremio

Addon serverless de alto rendimiento para **Nuvio** y **Stremio**, diseñado para ejecutarse en **Vercel** y realizar web scraping en tiempo real sobre el sitio web [https://www.ver-hentai.online](https://www.ver-hentai.online).

---

## 🚀 Características

- **Web Scraping en Tiempo Real**: Extrae automáticamente los servidores y reproductores embebidos (`iframes`) de cada episodio.
- **Soporte para Laravel Livewire**: Lee los estados reactivos iniciales (`wire:snapshot`) para obtener los servidores seleccionados por defecto.
- **Desencapsulado Directo de Streams (.m3u8)**: Desempaqueta scripts ofuscados (Dean Edwards `p,a,c,k,e,d`) en servidores como **LuluStream** para obtener el enlace directo en calidad 1080p.
- **Compatibilidad con Servidores Principales**: Extrae y normaliza reproductores de **DoodStream**, **LuluStream**, **VOE**, **SaveFiles**, **Usersdrive**, **Byse**, **Upfiles**, etc.
- **Configuración de `proxyHeaders`**: Incluye cabeceras `Referer` y `Origin` necesarias para evitar restricciones de reproducción y hotlinking.
- **Tolerancia a Fallos**: Bloques `try/catch` robustos que garantizan que el servidor siempre devuelva `{ "streams": [] }` si ocurre un error, evitando caídas en entornos serverless.
- **Arquitectura Serverless para Vercel**: 100% compatible con despliegues automáticos desde GitHub.

---

## 📁 Estructura del Proyecto

```text
addon-verhentai/
├── api/
│   └── index.js         # Punto de entrada de la aplicación Express y lógica del scraper
├── .gitignore           # Archivos y carpetas excluidas de Git
├── package.json         # Dependencias y scripts del proyecto
├── vercel.json          # Configuración serverless de rutas para Vercel
└── README.md            # Documentación y guía de despliegue
```

---

## 🛠️ 1. Probar el Servidor Localmente

### Paso 1: Instalar Dependencias
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

> **Nota para Windows (PowerShell):** Si tienes restricciones de ejecución de scripts, ejecuta `npm.cmd install`.

### Paso 2: Iniciar el Servidor
Puedes iniciar el servidor con cualquiera de los siguientes comandos:

**Con Node.js directamente:**
```bash
node api/index.js
```
o
```bash
npm start
```

**Con la CLI de Vercel (si tienes instalado `vercel` globalmente):**
```bash
vercel dev
```

### Paso 3: Probar los Endpoints

Una vez iniciado el servidor (por defecto en `http://localhost:7000`):

1. **Página de bienvenida:**
   Abre en tu navegador: [http://localhost:7000/](http://localhost:7000/)

2. **Manifiesto del Addon:**
   [http://localhost:7000/manifest.json](http://localhost:7000/manifest.json)
   ```json
   {
     "id": "com.verhentai.addon",
     "name": "VerHentai Addon",
     "version": "1.0.0",
     "description": "Addon para Nuvio y Stremio con streams en tiempo real de Ver-Hentai.online",
     "resources": ["stream"],
     "types": ["anime"],
     "idPrefixes": ["verhentai-"],
     "catalogs": []
   }
   ```

3. **Prueba de Streams de un Episodio:**
   [http://localhost:7000/stream/anime/verhentai-kanojo-no-tomodachi-3.json](http://localhost:7000/stream/anime/verhentai-kanojo-no-tomodachi-3.json)

---

## 🐙 2. Comandos para Subir el Proyecto a GitHub

Sigue estos pasos en tu terminal para publicar el repositorio en GitHub:

1. **Crea un nuevo repositorio en GitHub:**
   - Ve a [https://github.com/new](https://github.com/new).
   - Nómbralo, por ejemplo: `addon-verhentai`.
   - Selecciona **Public** o **Private** según tu preferencia (no marques "Initialize with README", ya que lo creamos aquí).
   - Haz clic en **Create repository**.

2. **Ejecuta los siguientes comandos en tu terminal local:**

```bash
# 1. Inicializar el repositorio Git local
git init

# 2. Agregar todos los archivos al seguimiento
git add .

# 3. Crear el primer commit
git commit -m "feat: Addon serverless de VerHentai para Nuvio y Stremio"

# 4. Asegurarse de que la rama principal sea 'main'
git branch -M main

# 5. Vincular con tu repositorio de GitHub (reemplaza TU_USUARIO y TU_REPO)
git remote add origin https://github.com/TU_USUARIO/addon-verhentai.git

# 6. Subir el código a GitHub
git push -u origin main
```

---

## ⚡ 3. Despliegue Serverless en Vercel

Una vez que tu repositorio esté en GitHub, el despliegue en Vercel toma menos de 2 minutos:

1. Inicia sesión en [Vercel](https://vercel.com/) con tu cuenta de GitHub.
2. En el panel principal (Dashboard), haz clic en **Add New...** > **Project**.
3. En la lista de repositorios, localiza `addon-verhentai` y haz clic en **Import**.
4. En la configuración del proyecto:
   - **Framework Preset**: Selecciona `Other` (o déjalo en automático, Vercel detectará la configuración de Node.js).
   - **Root Directory**: `./` (la raíz del repositorio).
   - No necesitas configurar variables de entorno adicionales a menos que desees personalizar el User-Agent.
5. Haz clic en el botón **Deploy**.
6. En pocos segundos, Vercel compilará la función serverless y te otorgará un dominio público, por ejemplo:
   ```text
   https://addon-verhentai.vercel.app
   ```

---

## 📱 4. Cómo Instalar el Addon en Nuvio o Stremio

1. Copia la URL de tu manifiesto generado por Vercel:
   ```text
   https://tu-proyecto.vercel.app/manifest.json
   ```
2. **En Stremio:**
   - Ve a la sección de **Addons** (icono de rompecabezas).
   - En el campo de búsqueda o en "Community Addons", pega la URL de tu manifiesto (`https://tu-proyecto.vercel.app/manifest.json`).
   - Haz clic en **Install** (Instalar).
3. **En Nuvio:**
   - Ve a **Ajustes** / **Addons**.
   - Añade el enlace del manifiesto y confirma la instalación.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
