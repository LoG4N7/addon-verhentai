const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const STREAM_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.ver-hentai.online';

// Mapeo de secciones para los catálogos del sitio web
const SECTION_CONFIG = {
  'verhentai-latest-episodes': { target: 'Episodios Recientes', name: 'Episodios Recientes' },
  'verhentai-recommended': { target: 'Hentai Recomendados', name: 'Hentai Recomendados' },
  'verhentai-top5': { target: 'Top 5 Hentai', name: 'Top 5 Hentai' },
  'verhentai-repaired': { target: 'Últimos Reparados', name: 'Últimos Reparados' },
  'verhentai-recent-hentai': { target: 'Hentai Recientes', name: 'Hentai Recientes' },
  'verhentai-upcoming': { target: 'Próximos Hentai', name: 'Próximos Hentai' },
  'verhentai-popular': { target: 'Lo Más Popular', name: 'Lo Más Popular' }
};

// Limpieza de títulos de metadatos
function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*-\s*(Tendencia|Nuevo|Próximo|Estreno)?\s*-\s*Hentai Online Gratis\s*\|\s*VerHentai/gi, '')
    .replace(/\s*—\s*Ver Online Subtitulado\s*\|\s*VerHentai/gi, '')
    .replace(/\s*\|\s*VerHentai/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Desempaquetador Dean Edwards p,a,c,k,e,d para scripts de reproductores
function unpackJs(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

// Extractor para LuluStream / Luluvido (desencapsula stream .m3u8 directo)
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
    // Si falla la extracción directa, se continúa con la versión embebida
  }
  return null;
}

// Extractor para YourUpload (desencapsula video directo .mp4)
async function extractYourUpload(url) {
  try {
    const embedUrl = url.replace('/watch/', '/embed/');
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.yourupload.com/'
      },
      timeout: 6000
    });
    const html = response.data;
    const fileMatch = html.match(/file:\s*["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i) ||
                      html.match(/<source\s+[^>]*src=["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i) ||
                      html.match(/<meta\s+property=["']og:video["']\s+content=["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i);
    if (fileMatch) {
      return fileMatch[1];
    }
  } catch (err) {
    // Fallback silencioso
  }
  return null;
}

// Filtro de publicidad y dominios no deseados
function isAdOrSpam(url) {
  if (!url || typeof url !== 'string') return true;
  const spamHosts = [
    'google', 'doubleclick', 'adservice', 'adsystem', 'popads',
    'propeller', 'juicyads', 'exoclick', 'trafficjunky', 'tsyndicate',
    'yandex', 'facebook.com', 'instagram.com', 't.me', 'tiktok.com',
    'youtube.com', 'twitter.com', 'x.com', 'discord.gg', 'discord.com',
    'monetag', 'adsterra', 'clickadu', 'hilltopads'
  ];
  return spamHosts.some(host => url.toLowerCase().includes(host));
}

// Identificar nombre del servidor
function identifyServer(url, text = '') {
  const lowerUrl = (url || '').toLowerCase();
  const lowerText = (text || '').toLowerCase();

  if (lowerText.includes('doodstream') || lowerUrl.includes('dood') || lowerUrl.includes('do7go') || lowerUrl.includes('playmogo')) {
    return 'DoodStream';
  }
  if (lowerText.includes('lulustream') || lowerUrl.includes('luluvido') || lowerUrl.includes('lulustream')) {
    return 'LuluStream';
  }
  if (lowerText.includes('yourupload') || lowerUrl.includes('yourupload')) {
    return 'YourUpload';
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

  if (text && text.trim().length > 0 && text.length < 30) {
    return text.replace(/\s+/g, ' ').trim();
  }

  return 'Reproductor Online';
}

// Determinar si una URL pertenece a un host de video conocido
function isVideoHost(url) {
  if (!url || typeof url !== 'string' || isAdOrSpam(url)) return false;
  const hosts = [
    'do7go.com', 'playmogo.com', 'dood', 'luluvido.com', 'lulustream.com',
    'yourupload.com', 'voe.sx', 'savefiles.com', 'usersdrive.com',
    'byseraguci.com', 'streamtape.com', 'mp4upload.com', 'uqload.com',
    'upfiles.com', 'mega.nz', 'ok.ru', 'derricknationtop.com'
  ];
  return hosts.some(host => url.includes(host));
}

// Normalizar URLs de reproductores embebidos
function normalizeEmbedUrl(url) {
  let normalized = (url || '').trim();
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized;
  }

  // DoodStream
  if (normalized.includes('playmogo.com/d/')) {
    normalized = normalized.replace('playmogo.com/d/', 'do7go.com/e/');
  } else if (normalized.includes('playmogo.com/e/')) {
    normalized = normalized.replace('playmogo.com/e/', 'do7go.com/e/');
  } else if (normalized.includes('/d/') && (normalized.includes('dood') || normalized.includes('do7go'))) {
    normalized = normalized.replace('/d/', '/e/');
  }

  // LuluStream
  if (normalized.includes('luluvido.com/d/')) {
    normalized = normalized.replace('luluvido.com/d/', 'luluvido.com/e/');
  } else if (normalized.includes('lulustream.com/d/')) {
    normalized = normalized.replace('lulustream.com/d/', 'lulustream.com/e/');
  }

  // YourUpload
  if (normalized.includes('yourupload.com/watch/')) {
    normalized = normalized.replace('yourupload.com/watch/', 'yourupload.com/embed/');
  }

  // VOE
  if (normalized.includes('voe.sx/') && !normalized.includes('voe.sx/e/')) {
    normalized = normalized.replace('voe.sx/', 'voe.sx/e/');
  }

  // SaveFiles
  if (normalized.includes('savefiles.com/') && !normalized.includes('/e/')) {
    normalized = normalized.replace('savefiles.com/', 'savefiles.com/e/');
  }

  // Byse
  if (normalized.includes('byseraguci.com/d/')) {
    normalized = normalized.replace('/d/', '/e/');
  }

  // Streamtape
  if (normalized.includes('streamtape.com/v/')) {
    normalized = normalized.replace('streamtape.com/v/', 'streamtape.com/e/');
  }

  // Mp4Upload
  if (normalized.includes('mp4upload.com/') && !normalized.includes('/embed-') && !normalized.includes('/embed/')) {
    const codeMatch = normalized.match(/mp4upload\.com\/([a-zA-Z0-9]+)/);
    if (codeMatch) {
      normalized = `https://www.mp4upload.com/embed-${codeMatch[1]}.html`;
    }
  }

  // Uqload
  if (normalized.includes('uqload.') && !normalized.includes('/embed-') && !normalized.includes('/embed/')) {
    const codeMatch = normalized.match(/uqload\.[a-z]+\/([a-zA-Z0-9]+)/);
    if (codeMatch) {
      normalized = `https://uqload.com/embed-${codeMatch[1]}.html`;
    }
  }

  return normalized;
}

// Objeto del Manifiesto Oficial
const MANIFEST = {
  id: 'com.verhentai.addon',
  name: 'VerHentai Addon',
  version: '1.0.0',
  description: 'Addon oficial de Ver-Hentai.online para Nuvio y Stremio con Catálogos, Búsqueda, Metadatos y Streams',
  resources: ['catalog', 'meta', 'stream'],
  types: ['anime'],
  idPrefixes: ['verhentai-'],
  catalogs: [
    {
      type: 'anime',
      id: 'verhentai-latest-episodes',
      name: 'VerHentai - Episodios Recientes',
      extra: [{ name: 'search', isRequired: false }]
    },
    {
      type: 'anime',
      id: 'verhentai-recommended',
      name: 'VerHentai - Hentai Recomendados'
    },
    {
      type: 'anime',
      id: 'verhentai-top5',
      name: 'VerHentai - Top 5 Hentai'
    },
    {
      type: 'anime',
      id: 'verhentai-repaired',
      name: 'VerHentai - Últimos Reparados'
    },
    {
      type: 'anime',
      id: 'verhentai-recent-hentai',
      name: 'VerHentai - Hentai Recientes'
    },
    {
      type: 'anime',
      id: 'verhentai-upcoming',
      name: 'VerHentai - Próximos Hentai'
    },
    {
      type: 'anime',
      id: 'verhentai-popular',
      name: 'VerHentai - Lo Más Popular'
    }
  ]
};

// Página de bienvenida / status
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
        .card { background: #1e293b; border-radius: 16px; padding: 40px; max-width: 650px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h1 { color: #f59e0b; margin-top: 0; font-size: 28px; }
        p { color: #94a3b8; font-size: 16px; line-height: 1.6; }
        .badge { display: inline-block; background: #10b981; color: #042f2e; font-weight: bold; padding: 4px 10px; border-radius: 9999px; font-size: 13px; margin-bottom: 15px; }
        .btn { display: inline-block; background: #f59e0b; color: #0f172a; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 10px 5px; transition: transform 0.2s, background 0.2s; }
        .btn:hover { background: #fbbf24; transform: scale(1.05); }
        .btn-secondary { background: #334155; color: #f8fafc; }
        .btn-secondary:hover { background: #475569; }
        code { background: #0f172a; padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #38bdf8; font-size: 13px; word-break: break-all; }
        ul { text-align: left; color: #cbd5e1; font-size: 14px; margin: 15px 0 25px 0; }
        li { margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">● Servidor Activo & Serverless</span>
        <h1>VerHentai Addon</h1>
        <p>Integración completa de <strong>Ver-Hentai.online</strong> para <strong>Nuvio</strong> y <strong>Stremio</strong> con catálogos por secciones, motor de búsqueda, metadatos y extracción de streams en tiempo real.</p>
        <ul>
          <li>✨ <strong>7 Catálogos Oficiales:</strong> Episodios Recientes, Recomendados, Top 5, Reparados, Recientes, Próximos y Popular.</li>
          <li>🔍 <strong>Búsqueda en Tiempo Real:</strong> Compatible con el buscador nativo de Stremio y Nuvio.</li>
          <li>🎬 <strong>Metadatos Completos:</strong> Portadas, sinopsis y lista de todos los episodios por serie.</li>
          <li>⚡ <strong>Desencapsulado HD:</strong> Extracción de streams directos (.m3u8/.mp4) con proxyHeaders automáticos.</li>
        </ul>
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

// 1. Endpoint GET /manifest.json
app.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=86400, public');
  return res.json(MANIFEST);
});

// 2. Endpoint de Catálogo y Búsqueda: /catalog/anime/:id.json
app.get([
  '/catalog/anime/:id.json',
  '/catalog/anime/:id',
  '/catalog/anime/:id/search=:query.json',
  '/catalog/anime/:id/search=:query',
  '/catalog/anime/:id/:extra.json',
  '/catalog/anime/:id/:extra'
], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=900, public');

  try {
    const catalogId = req.params.id ? req.params.id.replace(/\.json$/, '') : '';
    
    // Extraer parámetro de búsqueda si existe (query param o extra route)
    let searchQuery = req.query.search || req.params.query || '';
    if (!searchQuery && req.params.extra) {
      const match = req.params.extra.match(/search=([^&]+)/i);
      if (match) {
        searchQuery = decodeURIComponent(match[1].replace(/\.json$/, ''));
      }
    }
    searchQuery = (searchQuery || '').trim();

    const metas = [];
    const seenSlugs = new Set();

    // Caso A: BÚSQUEDA
    if (searchQuery) {
      const searchUrl = `${BASE_URL}/hentai?search=${encodeURIComponent(searchQuery)}`;
      console.log(`[VerHentai] Ejecutando búsqueda para "${searchQuery}": ${searchUrl}`);

      const response = await axios.get(searchUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      $('a[href*="/infohentai/"], a[href*="/hentaionline/"]').each((_, link) => {
        const href = $(link).attr('href');
        if (!href) return;
        const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');

        let slug = '';
        if (cleanHref.includes('/infohentai/')) {
          slug = cleanHref.replace(/^\/infohentai\//, '').replace(/\.html.*$/, '');
        } else if (cleanHref.includes('/hentaionline/')) {
          slug = cleanHref.replace(/^\/hentaionline\//, '').replace(/\.html.*$/, '');
        }
        if (!slug || seenSlugs.has(slug)) return;
        seenSlugs.add(slug);

        const img = $(link).find('img');
        let poster = img.attr('src') || img.attr('data-src') || '';
        if (poster.startsWith('//')) poster = 'https:' + poster;

        let title = img.attr('alt') || $(link).find('h3, h4, p').first().text().trim() || $(link).attr('title') || '';
        title = cleanTitle(title);
        if (!title || title.length < 2) return;

        metas.push({
          id: `verhentai-${slug}`,
          type: 'anime',
          name: title,
          poster: poster,
          description: `Resultado de búsqueda: "${searchQuery}"`
        });
      });

      console.log(`[VerHentai] Búsqueda retornó ${metas.length} elementos`);
      return res.json({ metas });
    }

    // Caso B: SECCIONES DEL CATÁLOGO
    const config = SECTION_CONFIG[catalogId] || SECTION_CONFIG['verhentai-latest-episodes'];
    console.log(`[VerHentai] Cargando catálogo: ${catalogId} (${config.name})`);

    const response = await axios.get(BASE_URL, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    let headingEl = null;
    $('h1, h2, h3, h4').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.toLowerCase().includes(config.target.toLowerCase())) {
        headingEl = $(el);
        return false;
      }
    });

    if (!headingEl || !headingEl.length) {
      console.log(`[VerHentai] No se encontró el encabezado para ${config.target}`);
      return res.json({ metas: [] });
    }

    let container = headingEl.closest('section');
    if (!container.length) container = headingEl.parent().parent();

    const links = container.find('a[href*="/hentaionline/"], a[href*="/infohentai/"]');
    links.each((_, link) => {
      const href = $(link).attr('href');
      if (!href) return;
      const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');

      let slug = '';
      if (cleanHref.includes('/hentaionline/')) {
        slug = cleanHref.replace(/^\/hentaionline\//, '').replace(/\.html.*$/, '');
      } else if (cleanHref.includes('/infohentai/')) {
        slug = cleanHref.replace(/^\/infohentai\//, '').replace(/\.html.*$/, '');
      }
      if (!slug || seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      const img = $(link).find('img');
      let poster = img.attr('src') || img.attr('data-src') || '';
      if (poster.startsWith('//')) poster = 'https:' + poster;

      let title = img.attr('alt') || $(link).find('h3, h4, p').first().text().trim() || $(link).attr('title') || '';
      title = cleanTitle(title);
      if (!title || title.length < 2) return;

      metas.push({
        id: `verhentai-${slug}`,
        type: 'anime',
        name: title,
        poster: poster,
        description: `Sección: ${config.name}`
      });
    });

    console.log(`[VerHentai] Catálogo ${catalogId} retornó ${metas.length} elementos`);
    return res.json({ metas });

  } catch (error) {
    console.error(`[VerHentai] Error en /catalog: ${error.message}`);
    return res.json({ metas: [] });
  }
});

// 3. Endpoint de Metadatos Detallados: /meta/anime/:id.json
app.get(['/meta/anime/:id.json', '/meta/anime/:id'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=1800, public');

  try {
    let rawId = req.params.id ? req.params.id.replace(/\.json$/, '') : '';
    rawId = decodeURIComponent(rawId).trim();
    const cleanSlug = rawId.replace(/^verhentai-/, '');

    console.log(`[VerHentai] Solicitando metadatos para ID: ${rawId} (Slug: ${cleanSlug})`);

    // Intentar primero como anime completo en /infohentai/
    let targetUrl = `${BASE_URL}/infohentai/${cleanSlug}.html`;
    let response;
    let isEpisodeDirect = false;

    try {
      response = await axios.get(targetUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
        timeout: 10000
      });
    } catch (err) {
      // Si no existe en infohentai, intentar en hentaionline (página del episodio)
      isEpisodeDirect = true;
      targetUrl = `${BASE_URL}/hentaionline/${cleanSlug}.html`;
      response = await axios.get(targetUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
        timeout: 10000
      });
    }

    let $ = cheerio.load(response.data);
    let title = $('h1').first().text().trim();

    // Si el título es genérico o no cargó un anime válido, verificar si es página de episodio
    if (!title || title.toLowerCase().includes('ver hentai') || $('title').text().includes('VerHentai — Hentai Online Gratis')) {
      targetUrl = `${BASE_URL}/hentaionline/${cleanSlug}.html`;
      response = await axios.get(targetUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
        timeout: 10000
      });
      $ = cheerio.load(response.data);
      title = $('h1').first().text().trim();
      isEpisodeDirect = true;
    }

    // Si estamos en un episodio y hay enlace a la serie principal, obtener la ficha completa
    const seriesLink = $('a[href*="/infohentai/"]').first().attr('href');
    if (isEpisodeDirect && seriesLink) {
      try {
        const fullSeriesUrl = seriesLink.startsWith('http') ? seriesLink : `${BASE_URL}${seriesLink}`;
        const seriesResp = await axios.get(fullSeriesUrl, {
          headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
          timeout: 8000
        });
        const $series = cheerio.load(seriesResp.data);
        const seriesTitle = $series('h1').first().text().trim();
        if (seriesTitle && !seriesTitle.toLowerCase().includes('ver hentai')) {
          $ = $series;
          title = seriesTitle;
          targetUrl = fullSeriesUrl;
        }
      } catch (e) {
        // Continuar con los datos del episodio
      }
    }

    title = cleanTitle(title || $('meta[property="og:title"]').attr('content') || $('title').text());

    let poster = $('meta[property="og:image"]').attr('content') ||
                 $('img[src*="portadas"], img[src*="miniportadas"], img[src*="animes/covers"]').first().attr('src') || '';
    if (poster.startsWith('//')) poster = 'https:' + poster;

    let description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('.synopsis, .description, p.text-white\\/80, p.leading-relaxed').first().text().trim() ||
                      'Hentai disponible en Ver-Hentai.online';
    description = description.replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim();

    // Extraer lista completa de episodios
    const videos = [];
    const seenEpUrls = new Set();
    let epCounter = 1;

    $('a[href*="/hentaionline/"]').each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      href = href.replace(/^https?:\/\/[^\/]+/, '');
      if (seenEpUrls.has(href)) return;
      seenEpUrls.add(href);

      const epSlug = href.replace(/^\/hentaionline\//, '').replace(/\.html.*$/, '');
      const numMatch = epSlug.match(/-(\d+)$/);
      const epNum = numMatch ? parseInt(numMatch[1], 10) : epCounter;

      videos.push({
        id: `verhentai-${epSlug}`,
        title: `Episodio ${epNum}`,
        season: 1,
        episode: epNum
      });
      epCounter++;
    });

    // Si no tiene lista de episodios o es un OVA/Película único
    if (videos.length === 0) {
      videos.push({
        id: `verhentai-${cleanSlug}`,
        title: `${title} - Completo`,
        season: 1,
        episode: 1
      });
    }

    // Ordenar episodios ascendentemente
    videos.sort((a, b) => a.episode - b.episode);

    const meta = {
      id: rawId,
      type: 'anime',
      name: title,
      poster: poster,
      description: description,
      videos: videos
    };

    console.log(`[VerHentai] Metadatos listos: "${title}" con ${videos.length} episodios`);
    return res.json({ meta });

  } catch (error) {
    console.error(`[VerHentai] Error en /meta: ${error.message}`);
    return res.json({ meta: {} });
  }
});

// 4. Endpoint de Streams: /stream/anime/:id.json
app.get(['/stream/anime/:id.json', '/stream/anime/:id'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=1800, public');

  try {
    let rawId = req.params.id ? req.params.id.replace(/\.json$/, '') : '';
    rawId = decodeURIComponent(rawId).trim();
    let slug = rawId.replace(/^verhentai-/, '');

    // Construir la URL completa hacia la página del episodio
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

    console.log(`[VerHentai] Scraping streams para episodio: ${targetUrl}`);

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const streams = [];
    const seenUrls = new Set();

    function addStream(title, url, customHeaders = {}) {
      if (!url || seenUrls.has(url) || isAdOrSpam(url)) return;
      seenUrls.add(url);

      const requestHeaders = {
        'User-Agent': STREAM_USER_AGENT,
        'Referer': `${BASE_URL}/`,
        ...customHeaders
      };

      streams.push({
        name: 'VerHentai',
        title: title,
        url: url,
        isFree: true,
        behaviorHints: {
          notSupported: false,
          proxyHeaders: {
            request: requestHeaders
          }
        }
      });
    }

    // 1. Extraer reproductores embebidos / iframes de la página
    $('iframe').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !isAdOrSpam(src) && (isVideoHost(src) || src.includes('/e/'))) {
        const normUrl = normalizeEmbedUrl(src);
        const serverName = identifyServer(normUrl);
        addStream(`${serverName} (Reproductor Principal HD)`, normUrl);
      }
    });

    // 2. Extraer datos del snapshot reactivo de Livewire
    $('[wire\\:snapshot]').each((_, el) => {
      try {
        const snapshotRaw = $(el).attr('wire:snapshot');
        if (snapshotRaw) {
          const parsed = JSON.parse(snapshotRaw);
          const selectedData = parsed?.data?.selectedServerData;
          if (Array.isArray(selectedData)) {
            for (const item of selectedData) {
              if (item && item.embed_code && !isAdOrSpam(item.embed_code)) {
                const normUrl = normalizeEmbedUrl(item.embed_code);
                const sName = item?.server?.[0]?.name || identifyServer(normUrl);
                addStream(`${sName} (Reproductor HD)`, normUrl);
              }
            }
          }
        }
      } catch (err) {
        // Ignorar errores individuales de parseo
      }
    });

    // 3. Extraer servidores de la sección de descargas y opciones
    const candidateLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (isAdOrSpam(href)) return;

      if (isVideoHost(href)) {
        const rawText = $(el).text().replace(/\s+/g, ' ').trim();
        const serverName = identifyServer(href, rawText);
        candidateLinks.push({ url: href, serverName });
      }
    });

    // Procesar servidores encontrados y normalizar a sus formatos embed/iframe directos
    for (const item of candidateLinks) {
      const normEmbed = normalizeEmbedUrl(item.url);
      addStream(`${item.serverName} (Reproductor HD)`, normEmbed);
    }

    console.log(`[VerHentai] Streams encontrados (${streams.length}) para ${slug}`);
    return res.json({ streams });

  } catch (error) {
    console.error(`[VerHentai] Error en /stream: ${error.message}`);
    return res.json({ streams: [] });
  }
});

// Middleware de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Servidor local para pruebas
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  VerHentai Addon Full escuchando en: http://localhost:${PORT}`);
    console.log(`  Manifiesto: http://localhost:${PORT}/manifest.json`);
    console.log(`  Catálogo: http://localhost:${PORT}/catalog/anime/verhentai-latest-episodes.json`);
    console.log(`  Búsqueda: http://localhost:${PORT}/catalog/anime/verhentai-latest-episodes/search=kanojo.json`);
    console.log(`  Metadatos: http://localhost:${PORT}/meta/anime/verhentai-shinseki-no-ko-to-o-tomari-dakara.json`);
    console.log(`  Streams: http://localhost:${PORT}/stream/anime/verhentai-kanojo-no-tomodachi-3.json`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
