const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.ver-hentai.online';

// Dean Edwards p,a,c,k,e,d unpacker helper
function unpackJs(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

// Extractor para LuluStream / Luluvido (desencapsula el .m3u8 directo)
async function extractLuluStream(url) {
  try {
    const embedUrl = url.replace('/d/', '/e/');
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': BASE_URL
      },
      timeout: 6000
    });

    const html = response.data;
    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
    if (packedMatch) {
      const code = packedMatch[0];
      const paramsMatch = code.match(/}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
      if (paramsMatch) {
        const [, p, aStr, cStr, kStr] = paramsMatch;
        const a = parseInt(aStr, 10);
        const c = parseInt(cStr, 10);
        const k = kStr.split('|');
        const unpacked = unpackJs(p, a, c, k);
        const m3u8Match = unpacked.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (m3u8Match) {
          return m3u8Match[0];
        }
      }
    }
  } catch (err) {
    // Si falla la extracción directa, se continúa con la URL embebida
  }
  return null;
}

// Identificar nombre legible del servidor a partir de la URL o texto
function identifyServer(url, text = '') {
  const lowerUrl = (url || '').toLowerCase();
  const lowerText = (text || '').toLowerCase();

  if (lowerText.includes('doodstream') || lowerUrl.includes('dood') || lowerUrl.includes('do7go') || lowerUrl.includes('playmogo')) {
    return 'DoodStream';
  }
  if (lowerText.includes('lulustream') || lowerUrl.includes('luluvido') || lowerUrl.includes('lulustream')) {
    return 'LuluStream';
  }
  if (lowerText.includes('voe') || lowerUrl.includes('voe.sx') || lowerUrl.includes('derricknationtop')) {
    return 'VOE';
  }
  if (lowerText.includes('savefiles') || lowerUrl.includes('savefiles')) {
    return 'SaveFiles';
  }
  if (lowerText.includes('usersdrive') || lowerUrl.includes('usersdrive')) {
    return 'Usersdrive';
  }
  if (lowerText.includes('byse') || lowerUrl.includes('byseraguci')) {
    return 'Byse';
  }
  if (lowerText.includes('firestream') || lowerUrl.includes('firestream')) {
    return 'FireStream';
  }
  if (lowerText.includes('gupload') || lowerUrl.includes('gupload')) {
    return 'Gupload';
  }
  if (lowerText.includes('streamtape') || lowerUrl.includes('streamtape')) {
    return 'Streamtape';
  }
  if (lowerText.includes('mp4upload') || lowerUrl.includes('mp4upload')) {
    return 'Mp4Upload';
  }
  if (lowerText.includes('uqload') || lowerUrl.includes('uqload')) {
    return 'Uqload';
  }
  if (lowerText.includes('upfiles') || lowerUrl.includes('upfiles')) {
    return 'Upfiles';
  }
  if (lowerText.includes('okru') || lowerUrl.includes('ok.ru')) {
    return 'OK.ru';
  }
  if (lowerText.includes('mega') || lowerUrl.includes('mega.nz')) {
    return 'Mega';
  }

  // Si hay texto limpio disponible, usarlo
  if (text && text.trim().length > 0 && text.length < 30) {
    return text.replace(/\s+/g, ' ').trim();
  }

  return 'Reproductor Online';
}

// Determinar si una URL pertenece a un host de video conocido
function isVideoHost(url) {
  if (!url || typeof url !== 'string') return false;
  const hosts = [
    'do7go.com', 'playmogo.com', 'dood', 'luluvido.com', 'lulustream.com',
    'voe.sx', 'savefiles.com', 'usersdrive.com', 'byseraguci.com',
    'streamtape.com', 'mp4upload.com', 'uqload.com', 'upfiles.com',
    'mega.nz', 'ok.ru', 'derricknationtop.com'
  ];
  return hosts.some(host => url.includes(host));
}

// Convertir URL de descarga a URL de reproductor embebido
function normalizeEmbedUrl(url) {
  let normalized = url.trim();
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized;
  }

  // DoodStream: /d/ -> /e/
  if (normalized.includes('playmogo.com/d/')) {
    normalized = normalized.replace('playmogo.com/d/', 'do7go.com/e/');
  } else if (normalized.includes('/d/') && (normalized.includes('dood') || normalized.includes('do7go'))) {
    normalized = normalized.replace('/d/', '/e/');
  }

  // LuluStream: /d/ -> /e/
  if (normalized.includes('luluvido.com/d/')) {
    normalized = normalized.replace('/d/', '/e/');
  } else if (normalized.includes('lulustream.com/d/')) {
    normalized = normalized.replace('/d/', '/e/');
  }

  // VOE: / -> /e/ si no tiene /e/
  if (normalized.includes('voe.sx/') && !normalized.includes('voe.sx/e/')) {
    normalized = normalized.replace('voe.sx/', 'voe.sx/e/');
  }

  // SaveFiles: /d/ -> /e/
  if (normalized.includes('savefiles.com/') && !normalized.includes('/e/')) {
    normalized = normalized.replace('savefiles.com/', 'savefiles.com/e/');
  }

  // Byse: /d/ -> /e/
  if (normalized.includes('byseraguci.com/d/')) {
    normalized = normalized.replace('/d/', '/e/');
  }

  return normalized;
}

// Página de inicio descriptiva
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>VerHentai Addon para Nuvio & Stremio</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
        .card { background: #1e293b; border-radius: 16px; padding: 40px; max-width: 600px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h1 { color: #f59e0b; margin-top: 0; }
        p { color: #94a3b8; font-size: 16px; line-height: 1.6; }
        .btn { display: inline-block; background: #f59e0b; color: #0f172a; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 10px 5px; transition: transform 0.2s, background 0.2s; }
        .btn:hover { background: #fbbf24; transform: scale(1.05); }
        .btn-secondary { background: #334155; color: #f8fafc; }
        .btn-secondary:hover { background: #475569; }
        code { background: #0f172a; padding: 3px 8px; border-radius: 4px; font-family: monospace; color: #38bdf8; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>VerHentai Addon</h1>
        <p>Addon Serverless oficial para Nuvio y Stremio con web scraping en tiempo real de <strong>Ver-Hentai.online</strong>.</p>
        <p>Estado del servicio: <span style="color:#10b981; font-weight:bold;">● Operativo</span></p>
        <div>
          <a class="btn" href="stremio://${req.headers.host}/manifest.json">Instalar en Stremio</a>
          <a class="btn btn-secondary" href="/manifest.json">Ver Manifiesto JSON</a>
        </div>
        <p style="margin-top: 25px; font-size: 13px;">URL del manifiesto: <code>https://${req.headers.host}/manifest.json</code></p>
      </div>
    </body>
    </html>
  `);
});

// Endpoint GET /manifest.json
app.get('/manifest.json', (req, res) => {
  const manifest = {
    id: 'com.verhentai.addon',
    name: 'VerHentai Addon',
    version: '1.0.0',
    description: 'Addon para Nuvio y Stremio con streams en tiempo real de Ver-Hentai.online',
    resources: ['stream'],
    types: ['anime'],
    idPrefixes: ['verhentai-'],
    catalogs: []
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=86400, public');
  return res.json(manifest);
});

// Endpoint GET /stream/anime/:id.json (y /stream/anime/:id)
app.get(['/stream/anime/:id.json', '/stream/anime/:id'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=1800, public');

  try {
    let rawId = req.params.id || '';
    if (rawId.endsWith('.json')) {
      rawId = rawId.slice(0, -5);
    }
    rawId = decodeURIComponent(rawId).trim();

    // Eliminar el prefijo 'verhentai-'
    let slug = rawId.replace(/^verhentai-/, '');

    // Construir la URL completa hacia la página del episodio en ver-hentai.online
    let targetUrl;
    if (slug.startsWith('http://') || slug.startsWith('https://')) {
      targetUrl = slug;
    } else if (slug.startsWith('/')) {
      targetUrl = `${BASE_URL}${slug}`;
    } else if (slug.startsWith('hentaionline/')) {
      targetUrl = `${BASE_URL}/${slug}`;
    } else {
      targetUrl = `${BASE_URL}/hentaionline/${slug}`;
    }

    if (!targetUrl.endsWith('.html')) {
      targetUrl += '.html';
    }

    console.log(`[VerHentai] Scraping URL del episodio: ${targetUrl}`);

    // Petición HTTP con User-Agent de navegador real
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const streams = [];
    const seenUrls = new Set();

    // Función auxiliar para agregar stream sin duplicados
    function addStream(title, url, customHeaders = {}) {
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);

      const requestHeaders = {
        Referer: `${BASE_URL}/`,
        ...customHeaders
      };

      streams.push({
        title: title,
        url: url,
        behaviorHints: {
          proxyHeaders: {
            request: requestHeaders
          }
        }
      });
    }

    // 1. Extraer iframe principal del reproductor
    $('iframe').each((_, el) => {
      const src = $(el).attr('src');
      if (src && (isVideoHost(src) || src.includes('/e/'))) {
        const normUrl = normalizeEmbedUrl(src);
        const serverName = identifyServer(normUrl);
        addStream(`${serverName} (Principal HD)`, normUrl);
      }
    });

    // 2. Extraer datos del snapshot de Livewire
    $('[wire\\:snapshot]').each((_, el) => {
      try {
        const snapshotRaw = $(el).attr('wire:snapshot');
        if (snapshotRaw) {
          const parsed = JSON.parse(snapshotRaw);
          const selectedData = parsed?.data?.selectedServerData;
          if (Array.isArray(selectedData)) {
            for (const item of selectedData) {
              if (item && item.embed_code) {
                const sName = item?.server?.[0]?.name || identifyServer(item.embed_code);
                addStream(`${sName} (HD)`, normalizeEmbedUrl(item.embed_code));
              }
            }
          }
        }
      } catch (err) {
        // Ignorar errores de parseo individual
      }
    });

    // 3. Extraer servidores de la sección de descargas y opciones
    const candidateLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (/(instagram|t\.me|tiktok|youtube|facebook|twitter|reddit)\.com/i.test(href)) return;

      if (isVideoHost(href)) {
        const rawText = $(el).text().replace(/\s+/g, ' ').trim();
        const serverName = identifyServer(href, rawText);
        candidateLinks.push({ url: href, serverName });
      }
    });

    // Procesar servidores encontrados y aplicar lógica de extracción / desencapsulado
    for (const item of candidateLinks) {
      const normEmbed = normalizeEmbedUrl(item.url);

      // Si es LuluStream, intentar desencapsular el stream master .m3u8 directo
      if (item.serverName === 'LuluStream') {
        const directM3u8 = await extractLuluStream(item.url);
        if (directM3u8) {
          addStream(`LuluStream (Direct HLS 1080p)`, directM3u8, {
            Referer: 'https://luluvido.com/',
            Origin: 'https://luluvido.com',
            'User-Agent': USER_AGENT
          });
        }
      }

      // Agregar versión embebida del servidor
      addStream(`${item.serverName} (HD)`, normEmbed);
    }

    console.log(`[VerHentai] Streams encontrados (${streams.length}) para ${slug}`);
    return res.json({ streams });

  } catch (error) {
    console.error(`[VerHentai] Error procesando streams: ${error.message}`);
    // Siempre retornar un array vacío de streams en caso de fallo para no romper el addon
    return res.json({ streams: [] });
  }
});

// Middleware de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Para ejecución local o en servidor independiente
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  VerHentai Addon escuchando en: http://localhost:${PORT}`);
    console.log(`  Manifiesto: http://localhost:${PORT}/manifest.json`);
    console.log(`  Test stream: http://localhost:${PORT}/stream/anime/verhentai-kanojo-no-tomodachi-3.json`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
