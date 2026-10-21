# VerHentai Addon para Nuvio & Stremio

Addon serverless completo de alto rendimiento para **Nuvio** y **Stremio**, diseñado para ejecutarse en **Vercel** y realizar web scraping en tiempo real sobre el sitio web [https://www.ver-hentai.online](https://www.ver-hentai.online).

---

## 🚀 Arquitectura y Características

- **Catálogos por Secciones**:
  - `verhentai-latest-episodes`: Episodios Recientes (con soporte para búsqueda).
  - `verhentai-recommended`: Hentai Recomendados.
  - `verhentai-top5`: Top 5 Hentai.
  - `verhentai-repaired`: Últimos Reparados.
  - `verhentai-recent-hentai`: Hentai Recientes.
  - `verhentai-upcoming`: Próximos Hentai.
  - `verhentai-popular`: Lo Más Popular.
- **Motor de Búsqueda Integrado**: Permite buscar cualquier título directamente desde la barra de búsqueda de Nuvio o Stremio.
- **Metadatos Detallados (`/meta`)**: Extrae portada, sinopsis y genera la lista completa de episodios ordenados cronológicamente por serie (o episodio único para OVAs/películas).
- **Web Scraping de Streams en Tiempo Real (`/stream`)**: Extrae servidores y reproductores embebidos (`iframes`), datos reactivos de **Laravel Livewire** (`wire:snapshot`) y enlaces de servidores.
- **Desencapsulado Directo de Streams (.m3u8 y .mp4)**: Desempaqueta scripts ofuscados (Dean Edwards `p,a,c,k,e,d`) en servidores como **LuluStream** (extrayendo master `.m3u8` en 1080p) y enlaces directos de **YourUpload** (`.mp4`).
- **Filtro Anti-Publicidad**: Bloquea URLs y scripts de redes de anuncios y rastreadores invasivos.
- **Cabeceras de Reproducción (`proxyHeaders`)**: Configura automáticamente cabeceras como `Referer` y `Origin` para garantizar la reproducción sin bloqueos por hotlinking.
- **Tolerancia a Fallos Serverless**: Respuestas seguras con `{ "metas": [] }`, `{ "meta": {} }` y `{ "streams": [] }` ante cualquier eventualidad.

---

## 📁 Estructura del Proyecto

```text
addon-verhentai/
├── api/
│   └── index.js         # Servidor Express, endpoints de Catálogo, Búsqueda, Metadatos y Streams
├── .gitignore           # Archivos y carpetas excluidas de Git
├── manifest.json        # Manifiesto oficial estático del addon
├── package.json         # Dependencias y scripts del proyecto
├── vercel.json          # Configuración de rutas serverless para Vercel
└── README.md            # Documentación y guía de despliegue
```

---

## 🛠️ 1. Probar el Servidor Localmente

### Paso 1: Instalar Dependencias
```bash
npm install
```
*(En Windows PowerShell, si la política de scripts está restringida, ejecuta `npm.cmd install`)*

### Paso 2: Iniciar el Servidor
```bash
node api/index.js
```
o
```bash
npm start
```

### Paso 3: Endpoints de Prueba

Una vez iniciado en `http://localhost:7000`:

1. **Página de bienvenida:**
   [http://localhost:7000/](http://localhost:7000/)

2. **Manifiesto:**
   [http://localhost:7000/manifest.json](http://localhost:7000/manifest.json)

3. **Catálogo (Episodios Recientes):**
   [http://localhost:7000/catalog/anime/verhentai-latest-episodes.json](http://localhost:7000/catalog/anime/verhentai-latest-episodes.json)

4. **Búsqueda en Tiempo Real:**
   [http://localhost:7000/catalog/anime/verhentai-latest-episodes/search=kanojo.json](http://localhost:7000/catalog/anime/verhentai-latest-episodes/search=kanojo.json)

5. **Metadatos de una Serie:**
   [http://localhost:7000/meta/anime/verhentai-shinseki-no-ko-to-o-tomari-dakara.json](http://localhost:7000/meta/anime/verhentai-shinseki-no-ko-to-o-tomari-dakara.json)

6. **Streams de un Episodio:**
   [http://localhost:7000/stream/anime/verhentai-kanojo-no-tomodachi-3.json](http://localhost:7000/stream/anime/verhentai-kanojo-no-tomodachi-3.json)

---

## 🐙 2. Comandos para Subir el Proyecto a GitHub

```bash
# 1. Inicializar el repositorio Git (si no está inicializado)
git init

# 2. Agregar todos los archivos
git add .

# 3. Crear el commit
git commit -m "feat: Soporte completo para catálogos, búsqueda, metadatos y streams"

# 4. Asegurarse de estar en la rama main
git branch -M main

# 5. Conectar tu repositorio remoto (reemplaza con tu URL de GitHub)
git remote add origin https://github.com/TU_USUARIO/addon-verhentai.git

# 6. Subir los cambios
git push -u origin main
```

---

## ⚡ 3. Despliegue en Vercel

1. Ve a [Vercel](https://vercel.com/) e inicia sesión con GitHub.
2. Haz clic en **Add New...** > **Project** e importa `addon-verhentai`.
3. Mantén la configuración por defecto y haz clic en **Deploy**.
4. Tu URL pública será:
   ```text
   https://tu-proyecto.vercel.app/manifest.json
   ```

---

## 📱 4. Instalación en Nuvio o Stremio

- **En Stremio:** Pega la URL `https://tu-proyecto.vercel.app/manifest.json` en la barra de búsqueda de Addons y pulsa **Install**.
- **En Nuvio:** Añade el enlace del manifiesto en la sección de Addons en Ajustes.

---

## 📄 Licencia

MIT
