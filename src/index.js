const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { loadConfig, saveConfig, ensureDataDir } = require('./lib/config');
const { searchVideos, getChannelIdFromInput, fetchChannelLatestVideos, fetchChannelTitleAndThumb } = require('./lib/youtube');
const { getStreamUrlForVideo, createVideoStream } = require('./lib/yt.js');

const APP_PORT = process.env.PORT ? Number(process.env.PORT) : 3100;

ensureDataDir();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

function buildManifest() {
    const config = loadConfig();
    const channelNames = config.channels && config.channels.length > 0 
        ? config.channels.map(ch => ch.name || ch.url).filter(Boolean)
        : [];
    
    const baseUrl = process.env.PUBLIC_HOST || `http://localhost:${APP_PORT}`;
    
    // Costruisci URL di configurazione per Stremio con parametri
    const configParams = new URLSearchParams();
    if (config.apiKey) configParams.set('apiKey', config.apiKey);
    if (config.channels && config.channels.length > 0) {
        const channelsData = config.channels.map(ch => ch.url).join('\n');
        configParams.set('channels', channelsData);
    }
    
    // URL del manifest con parametri di configurazione
    const manifestUrl = configParams.toString() ? 
        `${baseUrl}/manifest.json?${configParams.toString()}` : 
        `${baseUrl}/manifest.json`;
    
    return {
        id: 'com.omg.youtube',
        name: 'OMG YouTube',
        description: 'Addon YouTube per Stremio con ricerca e canali seguiti',
        version: '1.0.0',
        logo: 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
        background: 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
        contactEmail: 'admin@omg-youtube.com',
        catalogs: [
            {
                type: 'movie',
                id: 'omg-youtube-search',
                name: 'Ricerca YouTube',
                extra: [
                    { name: 'search', isRequired: true, options: [''] }
                ]
            },
            {
                type: 'channel',
                id: 'omg-youtube-followed',
                name: 'Canali Seguiti',
                extra: [
                    { name: 'genre', isRequired: false, options: channelNames }
                ]
            }
        ],
        resources: [
            'catalog',
            'stream',
            'meta'
        ],
        types: ['movie', 'channel'],
        idPrefixes: ['yt'],
        // URL di configurazione per Stremio (senza parametri)
        configuration: `${baseUrl}/`,
        // Endpoint proxy per streaming
        proxy: `${baseUrl}/proxy`
    };
}

// Manifest
app.get('/manifest.json', (req, res) => {
    try {
        // Leggi i parametri di configurazione dall'URL
        const apiKey = req.query.apiKey;
        const channelsParam = req.query.channels;
        
        // Costruisci configurazione temporanea dai parametri URL
        let tempConfig = { apiKey: '', channels: [] };
        
        if (apiKey) {
            tempConfig.apiKey = apiKey;
        }
        
        if (channelsParam) {
            const channelUrls = channelsParam.split('\n').map(url => url.trim()).filter(url => url.length > 0);
            tempConfig.channels = channelUrls.map(url => ({ 
                url, 
                name: extractChannelNameFromUrl(url) 
            }));
        }
        
        // Genera manifest dinamico con la configurazione temporanea
        const manifest = buildManifestFromConfig(tempConfig);
        
        res.json(manifest);
    } catch (error) {
        console.error('Manifest error:', error.message);
        // Fallback al manifest base se ci sono errori
        res.json(buildManifestFromConfig({}));
    }
});

// Funzione per estrarre il nome del canale dall'URL
function extractChannelNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.pathname.includes('@')) {
            return '@' + urlObj.pathname.split('@')[1];
        } else if (urlObj.pathname.includes('/channel/')) {
            return 'Channel ' + urlObj.pathname.split('/channel/')[1];
        } else if (urlObj.pathname.includes('/c/')) {
            return 'Custom ' + urlObj.pathname.split('/c/')[1];
        } else {
            return urlObj.hostname;
        }
    } catch (error) {
        return url;
    }
}

// Funzione per generare manifest da configurazione specifica
function buildManifestFromConfig(config) {
    const channelNames = config.channels && config.channels.length > 0 
        ? config.channels.map(ch => ch.name || ch.url).filter(Boolean)
        : [];
    
    const baseUrl = process.env.PUBLIC_HOST || `http://localhost:${APP_PORT}`;
    
    return {
        id: 'com.omg.youtube',
        name: 'OMG YouTube',
        description: 'Addon YouTube per Stremio con ricerca e canali seguiti',
        version: '1.0.0',
        logo: 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
        background: 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
        contactEmail: 'admin@omg-youtube.com',
        catalogs: [
            {
                type: 'movie',
                id: 'omg-youtube-search',
                name: 'Ricerca YouTube',
                extra: [
                    { name: 'search', isRequired: true, options: [''] }
                ]
            },
            {
                type: 'channel',
                id: 'omg-youtube-followed',
                name: 'Canali Seguiti',
                extra: [
                    { name: 'genre', isRequired: false, options: channelNames }
                ]
            }
        ],
        resources: [
            'catalog',
            'stream',
            'meta'
        ],
        types: ['movie', 'channel'],
        idPrefixes: ['yt'],
        // URL di configurazione per Stremio (senza parametri)
        configuration: `${baseUrl}/`,
        // Endpoint proxy per streaming
        proxy: `${baseUrl}/proxy`
    };
}

// Funzione originale buildManifest per compatibilità
function buildManifest() {
    const config = loadConfig();
    return buildManifestFromConfig(config);
}

// Catalog endpoint
app.get('/catalog/:type/:id/:extra?.json', async (req, res) => {
    try {
        const { type, id, extra } = req.params;
        
        // Leggi i parametri di configurazione dall'URL del manifest
        const manifestUrl = req.get('Referer') || req.headers.referer || '';
        let config = { apiKey: '', channels: [] };
        
        try {
            // Estrai parametri dall'URL del manifest
            if (manifestUrl.includes('manifest.json')) {
                const urlObj = new URL(manifestUrl);
                const apiKey = urlObj.searchParams.get('apiKey');
                const channelsParam = urlObj.searchParams.get('channels');
                
                if (apiKey) {
                    config.apiKey = apiKey;
                }
                
                if (channelsParam) {
                    const channelUrls = channelsParam.split('\n').map(url => url.trim()).filter(url => url.length > 0);
                    config.channels = channelUrls.map(url => ({ 
                        url, 
                        name: extractChannelNameFromUrl(url) 
                    }));
                }
            }
        } catch (error) {
            console.log('Fallback to server config for catalog');
            // Fallback alla configurazione del server se non riesci a leggere dall'URL
            config = loadConfig();
        }
        
        if (type === 'movie' && id === 'omg-youtube-search') {
            // Ricerca video YouTube
            const searchQuery = extra ? decodeURIComponent(extra) : '';
            if (!searchQuery) {
                return res.json({ metas: [] });
            }
            
            console.log(`Search request: ${searchQuery}`);
            
            try {
                const videos = await searchVideos(searchQuery, config.apiKey);
                const metas = videos.map(video => ({
                    id: `yt_${video.id}`,
                    type: 'movie',
                    name: video.title,
                    description: video.description,
                    poster: video.thumbnail,
                    posterShape: 'landscape',
                    logo: video.channelThumbnail,
                    background: video.thumbnail,
                    genre: ['YouTube'],
                    releaseInfo: video.publishedAt,
                    director: video.channelTitle,
                    cast: [video.channelTitle],
                    country: 'YouTube',
                    language: 'it',
                    subtitles: [],
                    year: new Date(video.publishedAt).getFullYear(),
                    released: video.publishedAt,
                    links: [
                        {
                            name: 'YouTube',
                            category: 'watch',
                            url: `https://www.youtube.com/watch?v=${video.id}`
                        }
                    ]
                }));
                
                res.json({ metas });
                
            } catch (error) {
                console.error('Search error:', error.message);
                res.json({ metas: [] });
            }
            
        } else if (type === 'channel' && id === 'omg-youtube-followed') {
            // Canali seguiti
            const channels = config.channels || [];
            
            if (!extra) {
                // Se non è specificato un canale, restituisci la lista dei canali disponibili
                // Stremio può mostrare questo come "seleziona un canale"
                const availableChannels = channels.map((c) => ({
                    id: `genre_${c.name}`,
                    type: 'channel',
                    name: c.name,
                    description: `Canale: ${c.name}`,
                    poster: c.thumbnail || 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
                    posterShape: 'square',
                    logo: c.thumbnail || 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
                    background: c.thumbnail || 'https://www.youtube.com/s/desktop/12d6b090/img/favicon_144x144.png',
                    genre: ['YouTube'],
                    releaseInfo: 'Canale seguito',
                    director: c.name,
                    cast: [c.name],
                    country: 'YouTube',
                    language: 'it',
                    subtitles: [],
                    year: new Date().getFullYear(),
                    released: new Date().toISOString(),
                    links: [
                        {
                            name: 'YouTube',
                            category: 'channel',
                            url: c.url
                        }
                    ]
                }));
                
                return res.json({ metas: availableChannels });
            }
            
            // Estrai il nome del canale dall'extra
            const chosen = decodeURIComponent(extra);
            console.log(`Channel request for: ${chosen}`);
            
            const channel = channels.find((c) => c.name === chosen);
            if (!channel) return res.json({ metas: [] });
            
            try {
                const videos = await fetchChannelLatestVideos(channel.url, config.apiKey);
                const metas = videos.map(video => ({
                    id: `yt_${video.id}`,
                    type: 'movie',
                    name: video.title,
                    description: video.description,
                    poster: video.thumbnail,
                    posterShape: 'landscape',
                    logo: video.channelThumbnail,
                    background: video.thumbnail,
                    genre: ['YouTube'],
                    releaseInfo: video.publishedAt,
                    director: video.channelTitle,
                    cast: [video.channelTitle],
                    country: 'YouTube',
                    language: 'it',
                    subtitles: [],
                    year: new Date(video.publishedAt).getFullYear(),
                    released: video.publishedAt,
                    links: [
                        {
                            name: 'YouTube',
                            category: 'watch',
                            url: `https://www.youtube.com/watch?v=${video.id}`
                        }
                    ]
                }));
                
                res.json({ metas });
                
            } catch (error) {
                console.error('Channel videos error:', error.message);
                res.json({ metas: [] });
            }
            
        } else {
            res.json({ metas: [] });
        }
        
    } catch (error) {
        console.error('Catalog error:', error.message);
        res.status(500).json({ error: 'Errore nel catalogo' });
    }
});

// Endpoint per ottenere informazioni sullo stream (per compatibilità)
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        
        // Estrai videoId dall'id (rimuovi prefisso yt_ se presente)
        let videoId = id;
        if (id.startsWith('yt_')) {
            videoId = id.substring(3);
        }
        
        console.log(`Stream request for video: ${videoId}`);
        
        const baseUrl = process.env.PUBLIC_HOST || `http://localhost:${APP_PORT}`;
        
        // Restituisci l'URL del proxy invece dell'URL diretto di Google
        res.json({
            streams: [{
                url: `${baseUrl}/proxy/${type}/${id}`,
                title: 'OMG YouTube',
                ytId: videoId,
                quality: 'best',
                format: 'mp4'
            }]
        });
        
    } catch (error) {
        console.error('Stream error:', error.message);
        res.status(500).json({ error: 'Errore nel recupero dello stream' });
    }
});

// Nuovo endpoint per streaming proxy diretto
app.get('/proxy/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        
        // Estrai videoId dall'id (rimuovi prefisso yt_ se presente)
        let videoId = id;
        if (id.startsWith('yt_')) {
            videoId = id.substring(3);
        }
        
        console.log(`Proxy stream request for video: ${videoId}`);
        
        // Imposta gli header per lo streaming video
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Crea lo stream del video
        const videoStream = await createVideoStream(videoId);
        
        // Gestisci gli errori dello stream
        videoStream.on('error', (error) => {
            console.error('Video stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Errore nello streaming del video' });
            } else {
                res.end();
            }
        });
        
        // Inoltra lo stream alla risposta
        videoStream.pipe(res);
        
        // Gestisci la chiusura della connessione
        req.on('close', () => {
            console.log(`Client disconnected for video: ${videoId}`);
            videoStream.destroy();
        });
        
    } catch (error) {
        console.error('Proxy stream error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Errore nell\'avvio dello stream' });
        }
    }
});

// Admin API
app.get('/api/config', (req, res) => {
	res.json(loadConfig());
});

app.get('/api/channels', (req, res) => {
	const config = loadConfig();
	const channels = config.channels || [];
	res.json({ channels: channels.map(c => ({ name: c.name, url: c.url })) });
});

app.post('/api/config', async (req, res) => {
    const { apiKey, channels } = req.body || {};
    const providedApiKey = String(apiKey || '').trim();

    function deriveNameFromUrl(url) {
        try {
            const u = new URL(url);
            const h = u.pathname.match(/@([A-Za-z0-9._-]+)/);
            if (h) return `@${h[1]}`;
            const c = u.pathname.match(/channel\/([A-Za-z0-9_-]+)/);
            if (c) return c[1];
            return u.hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }

    const baseSanitized = Array.isArray(channels)
        ? channels
            .filter((c) => c && (c.url || c.name))
            .map((c) => {
                const url = String(c.url || '').trim();
                const name = String(c.name || '').trim() || deriveNameFromUrl(url);
                return { name, url };
            })
        : [];

    // Enrich channels with channelId and official title when possibile
    const enriched = [];
    for (const ch of baseSanitized) {
        let channelId = undefined;
        let name = ch.name;
        if (providedApiKey && ch.url) {
            try {
                channelId = await getChannelIdFromInput({ apiKey: providedApiKey, input: ch.url });
                if (channelId) {
                    const meta = await fetchChannelTitleAndThumb({ apiKey: providedApiKey, channelId });
                    if (meta.channelTitle) name = meta.channelTitle;
                }
            } catch {}
        }
        enriched.push({ name, url: ch.url, channelId });
    }

    const conf = { apiKey: providedApiKey, channels: enriched };
    saveConfig(conf);
    res.json(conf);
});

// Endpoint per configurazione tramite URL codificato
app.get('/configure', (req, res) => {
    try {
        // Estrai i parametri dalla query string
        const { apiKey, channels } = req.query;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key richiesta' });
        }
        
        // Costruisci la configurazione
        const config = {
            apiKey: apiKey,
            channels: channels ? channels.split('\n').map(url => url.trim()).filter(url => url.length > 0).map(url => ({ 
                url, 
                name: extractChannelNameFromUrl(url) 
            })) : []
        };
        
        // Genera l'URL di configurazione codificato
        const configParams = new URLSearchParams();
        configParams.set('apiKey', config.apiKey);
        if (config.channels.length > 0) {
            const channelsData = config.channels.map(ch => ch.url).join('\n');
            configParams.set('channels', channelsData);
        }
        
        const baseUrl = process.env.PUBLIC_HOST || `http://localhost:${APP_PORT}`;
        const configUrl = `${baseUrl}/configure?${configParams.toString()}`;
        
        // Codifica l'URL in base64
        const encodedConfig = Buffer.from(configUrl).toString('base64');
        const finalConfigUrl = `${baseUrl}/${encodedConfig}/configure`;
        
        // Genera anche l'URL del manifest con i parametri
        const manifestParams = new URLSearchParams();
        manifestParams.set('apiKey', config.apiKey);
        if (config.channels.length > 0) {
            const channelsData = config.channels.map(ch => ch.url).join('\n');
            manifestParams.set('channels', channelsData);
        }
        
        const manifestUrl = `${baseUrl}/manifest.json?${manifestParams.toString()}`;
        
        res.json({
            success: true,
            config: config,
            urls: {
                config: finalConfigUrl,
                manifest: manifestUrl,
                base64: encodedConfig
            }
        });
        
    } catch (error) {
        console.error('Configure error:', error.message);
        res.status(500).json({ error: 'Errore nella generazione della configurazione' });
    }
});

// Endpoint per configurazione tramite URL codificato in base64
app.get('/:encodedConfig/configure', (req, res) => {
    try {
        const { encodedConfig } = req.params;
        
        // Decodifica l'URL di configurazione
        const decodedUrl = Buffer.from(encodedConfig, 'base64').toString('utf-8');
        const urlObj = new URL(decodedUrl);
        
        // Estrai i parametri
        const apiKey = urlObj.searchParams.get('apiKey');
        const channelsParam = urlObj.searchParams.get('channels');
        
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key non valida' });
        }
        
        // Costruisci la configurazione
        const config = {
            apiKey: apiKey,
            channels: channelsParam ? channelsParam.split('\n').map(url => url.trim()).filter(url => url.length > 0).map(url => ({ 
                url, 
                name: extractChannelNameFromUrl(url) 
            })) : []
        };
        
        // Genera l'URL del manifest con i parametri
        const manifestParams = new URLSearchParams();
        manifestParams.set('apiKey', config.apiKey);
        if (config.channels.length > 0) {
            const channelsData = config.channels.map(ch => ch.url).join('\n');
            manifestParams.set('channels', channelsData);
        }
        
        const baseUrl = process.env.PUBLIC_HOST || `http://localhost:${APP_PORT}`;
        const manifestUrl = `${baseUrl}/manifest.json?${manifestParams.toString()}`;
        
        // Restituisci la pagina di configurazione con i parametri pre-compilati
        res.send(`
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OMG YouTube - Configurazione</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .url-display {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            font-family: monospace;
            word-break: break-all;
            position: relative;
        }
        .url-display h4 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .url-display .url {
            background: white;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #dee2e6;
            margin: 5px 0;
        }
        .copy-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            background: #6c757d;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .copy-btn:hover {
            background: #5a6268;
        }
        .btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            margin: 10px 5px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-success {
            background: linear-gradient(135deg, #27ae60, #2ecc71);
        }
        .info-box {
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .info-box h3 {
            margin: 0 0 10px 0;
            color: #1976d2;
        }
        .info-box p {
            margin: 5px 0;
            color: #1565c0;
        }
        .config-summary {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .config-summary h3 {
            margin: 0 0 10px 0;
            color: #155724;
        }
        .config-summary p {
            margin: 5px 0;
            color: #155724;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎥 OMG YouTube</h1>
            <p>Configurazione Addon Stremio</p>
        </div>
        
        <div class="content">
            <div class="info-box">
                <h3>🚀 Configurazione Caricata</h3>
                <p>La configurazione è stata caricata dall'URL di configurazione.</p>
                <p>Usa l'URL del manifest per installare l'addon in Stremio.</p>
            </div>

            <div class="config-summary">
                <h3>📋 Riepilogo Configurazione</h3>
                <p><strong>API Key:</strong> ${config.apiKey ? '✅ Configurata' : '❌ Non configurata'}</p>
                <p><strong>Canali:</strong> ${config.channels.length} canali configurati</p>
                ${config.channels.length > 0 ? '<p><strong>Canali:</strong></p><ul>' + config.channels.map(ch => `<li>${ch.name || ch.url}</li>`).join('') + '</ul>' : ''}
            </div>
            
            <div class="url-display">
                <h4>📋 URL Manifest (per Stremio)</h4>
                <div class="url" id="manifestUrl">${manifestUrl}</div>
                <button class="copy-btn" onclick="copyManifest()">Copia</button>
            </div>
            
            <div class="url-display">
                <h4>🔗 URL Configurazione (per condivisione)</h4>
                <div class="url" id="configUrl">${req.originalUrl}</div>
                <button class="copy-btn" onclick="copyConfigUrl()">Copia</button>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button class="btn btn-success" onclick="installInStremio()">📱 Installa in Stremio</button>
                <button class="btn" onclick="window.open('${baseUrl}/', '_blank')">⚙️ Modifica Configurazione</button>
            </div>
        </div>
    </div>

    <script>
        // Copia URL nel clipboard
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('URL copiato nel clipboard!');
            }).catch(() => {
                alert('Errore nella copia dell\'URL');
            });
        }

        // Funzioni per i pulsanti copia
        function copyManifest() {
            copyToClipboard(document.getElementById('manifestUrl').textContent);
        }

        function copyConfigUrl() {
            copyToClipboard(document.getElementById('configUrl').textContent);
        }

        // Installa in Stremio
        function installInStremio() {
            const manifestUrl = document.getElementById('manifestUrl').textContent;
            const stremioUrl = \`stremio://\${window.location.host}/manifest.json\`;
            window.open(stremioUrl, '_blank');
            alert('Apertura Stremio...');
        }
    </script>
</body>
</html>
        `);
        
    } catch (error) {
        console.error('Encoded config error:', error.message);
        res.status(500).json({ error: 'Errore nella decodifica della configurazione' });
    }
});

// Admin UI
app.get('/', (req, res) => {
    const config = loadConfig();
    const baseUrl = process.env.PUBLIC_HOST || `http://localhost:${APP_PORT}`;
    
    // Genera URL del manifest con parametri di configurazione
    const manifestParams = new URLSearchParams();
    if (config.apiKey) manifestParams.set('apiKey', config.apiKey);
    if (config.channels && config.channels.length > 0) {
        const channelsData = config.channels.map(ch => ch.url).join('\n');
        manifestParams.set('channels', channelsData);
    }
    
    const manifestUrl = manifestParams.toString() ? 
        `${baseUrl}/manifest.json?${manifestParams.toString()}` : 
        `${baseUrl}/manifest.json`;
    
    res.send(`
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OMG YouTube - Configurazione Addon Stremio</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .form-group {
            margin-bottom: 25px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #555;
        }
        input[type="text"], textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s ease;
            box-sizing: border-box;
        }
        input[type="text"]:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        textarea {
            min-height: 120px;
            resize: vertical;
            font-family: monospace;
        }
        .btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
            background: linear-gradient(135deg, #95a5a6, #7f8c8d);
        }
        .btn-success {
            background: linear-gradient(135deg, #27ae60, #2ecc71);
        }
        .url-display {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            font-family: monospace;
            word-break: break-all;
            position: relative;
        }
        .url-display h4 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .url-display .url {
            background: white;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #dee2e6;
            margin: 5px 0;
        }
        .copy-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            background: #6c757d;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .copy-btn:hover {
            background: #5a6268;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-weight: 500;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info-box {
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .info-box h3 {
            margin: 0 0 10px 0;
            color: #1976d2;
        }
        .info-box p {
            margin: 5px 0;
            color: #1565c0;
        }
        .important-note {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .important-note h4 {
            margin: 0 0 10px 0;
            color: #856404;
        }
        .important-note p {
            margin: 5px 0;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎥 OMG YouTube</h1>
            <p>Configurazione Addon Stremio con Streaming Diretto</p>
        </div>
        
        <div class="content">
            <div class="info-box">
                <h3>🚀 Streaming Diretto Implementato</h3>
                <p>Questo addon ora usa yt-dlp per streammare video direttamente a Stremio!</p>
                <p>• Endpoint proxy: <code>${baseUrl}/proxy</code></p>
                <p>• Streaming in tempo reale senza download</p>
                <p>• Compatibile con tutti i formati YouTube</p>
            </div>

            <div class="important-note">
                <h4>⚠️ IMPORTANTE: URL Manifest Dinamico</h4>
                <p>L'URL del manifest ora include i parametri di configurazione per generare dinamicamente il contenuto senza cache.</p>
                <p>Stremio riconoscerà questo come un URL valido e il server genererà il contenuto necessario in base alla richiesta.</p>
            </div>

            <form id="configForm">
                <div class="form-group">
                    <label for="apiKey">🔑 API Key Google YouTube:</label>
                    <input type="text" id="apiKey" name="apiKey" value="${config.apiKey || ''}" placeholder="Inserisci la tua API Key di Google YouTube">
                </div>
                
                <div class="form-group">
                    <label for="channels">📺 Canali YouTube Seguiti (uno per riga):</label>
                    <textarea id="channels" name="channels" placeholder="Inserisci un link per riga ai canali YouTube che vuoi seguire&#10;Esempio:&#10;https://www.youtube.com/@RaffaeleGaito&#10;https://www.youtube.com/@nomecanale">${config.channels ? config.channels.map(ch => ch.url).join('\\n') : ''}</textarea>
                </div>
                
                <div class="form-group">
                    <button type="submit" class="btn btn-success">💾 Salva Configurazione</button>
                    <button type="button" class="btn btn-secondary" onclick="generateConfigUrl()">🔗 Genera URL Configurazione</button>
                </div>
            </form>
            
            <div id="status"></div>
            
            <div class="url-display">
                <h4>📋 URL Manifest (per Stremio) - DINAMICO</h4>
                <div class="url" id="manifestUrl">${manifestUrl}</div>
                <button class="copy-btn" onclick="copyManifest()">Copia</button>
            </div>
            
            <div class="url-display">
                <h4>🔗 URL Configurazione (NON per Stremio)</h4>
                <div class="url" id="configUrl">${baseUrl}/</div>
                <button class="copy-btn" onclick="copyConfigUrl()">Copia</button>
            </div>
            
            <div class="url-display">
                <h4>🔐 URL Configurazione Codificato (base64)</h4>
                <div class="url" id="encodedConfigUrl">Genera configurazione per vedere l'URL</div>
                <button class="copy-btn" onclick="copyEncodedConfigUrl()">Copia</button>
            </div>
            
            <div class="url-display">
                <h4>🎬 Esempio Endpoint Proxy</h4>
                <div class="url" id="proxyUrl">${baseUrl}/proxy/movie/yt_VIDEO_ID</div>
                <button class="copy-btn" onclick="copyProxyUrl()">Copia</button>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button class="btn btn-success" onclick="installInStremio()">📱 Installa in Stremio</button>
            </div>
        </div>
    </div>

    <script>
        // Carica la configurazione all'avvio
        document.addEventListener('DOMContentLoaded', function() {
            loadConfig();
        });

        // Carica la configurazione dal server
        async function loadConfig() {
            try {
                const response = await fetch('/api/config');
                if (response.ok) {
                    const config = await response.json();
                    document.getElementById('apiKey').value = config.apiKey || '';
                    document.getElementById('channels').value = config.channels ? config.channels.map(ch => ch.url).join('\\n') : '';
                    // Aggiorna l'URL del manifest con i nuovi parametri
                    updateManifestUrl();
                }
            } catch (error) {
                console.error('Errore nel caricamento della configurazione:', error);
            }
        }

        // Aggiorna l'URL del manifest con i parametri correnti
        function updateManifestUrl() {
            const apiKey = document.getElementById('apiKey').value.trim();
            const channelsText = document.getElementById('channels').value.trim();
            
            const params = new URLSearchParams();
            if (apiKey) params.set('apiKey', apiKey);
            if (channelsText) {
                const channels = channelsText.split('\\n').map(line => line.trim()).filter(line => line.length > 0);
                params.set('channels', channels.join('\\n'));
            }
            
            const manifestUrl = params.toString() ? 
                \`\${window.location.origin}/manifest.json?\${params.toString()}\` : 
                \`\${window.location.origin}/manifest.json\`;
            
            document.getElementById('manifestUrl').textContent = manifestUrl;
        }

        // Salva la configurazione
        async function saveConfig() {
            const apiKey = document.getElementById('apiKey').value.trim();
            const channelsText = document.getElementById('channels').value.trim();
            
            if (!apiKey) {
                showStatus('Inserisci l\'API Key di Google YouTube', 'error');
                return;
            }
            
            const channels = channelsText.split('\\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(url => ({ url, name: extractChannelName(url) }));
            
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ apiKey, channels })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.apiKey || result.channels) {
                        showStatus('Configurazione salvata con successo!', 'success');
                        // Ricarica i campi per mostrare i dati salvati
                        document.getElementById('apiKey').value = result.apiKey || '';
                        document.getElementById('channels').value = result.channels ? result.channels.map(ch => ch.url).join('\\n') : '';
                        // Aggiorna l'URL del manifest
                        updateManifestUrl();
                    } else {
                        showStatus('Errore nel salvataggio della configurazione', 'error');
                    }
                } else {
                    showStatus('Errore nel salvataggio della configurazione', 'error');
                }
            } catch (error) {
                console.error('Errore nel salvataggio:', error);
                showStatus('Errore nel salvataggio della configurazione', 'error');
            }
        }

        // Estrae il nome del canale dall'URL
        function extractChannelName(url) {
            try {
                const urlObj = new URL(url);
                if (urlObj.pathname.includes('@')) {
                    return '@' + urlObj.pathname.split('@')[1];
                } else if (urlObj.pathname.includes('/channel/')) {
                    return 'Channel ' + urlObj.pathname.split('/channel/')[1];
                } else if (urlObj.pathname.includes('/c/')) {
                    return 'Custom ' + urlObj.pathname.split('/c/')[1];
                } else {
                    return urlObj.hostname;
                }
            } catch (error) {
                return url;
            }
        }

        // Mostra messaggi di stato
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 5000);
        }

        // Copia URL nel clipboard
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showStatus('URL copiato nel clipboard!', 'success');
            }).catch(() => {
                showStatus('Errore nella copia dell\'URL', 'error');
            });
        }

        // Funzioni per i pulsanti copia
        function copyManifest() {
            copyToClipboard(document.getElementById('manifestUrl').textContent);
        }

        function copyConfigUrl() {
            copyToClipboard(document.getElementById('configUrl').textContent);
        }

        function copyEncodedConfigUrl() {
            const apiKey = document.getElementById('apiKey').value.trim();
            const channelsText = document.getElementById('channels').value.trim();
            
            if (!apiKey) {
                showStatus('Inserisci prima l\'API Key', 'error');
                return;
            }
            
            const baseUrl = window.location.origin;
            const configParams = new URLSearchParams();
            configParams.set('apiKey', apiKey);
            
            if (channelsText) {
                const channels = channelsText.split('\\n').map(line => line.trim()).filter(line => line.length > 0);
                configParams.set('channels', channels.join('\\n'));
            }
            
            const configUrl = \`\${baseUrl}/configure?\${configParams.toString()}\`;
            
            // Genera l'URL codificato
            fetch(configUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.urls.config) {
                        copyToClipboard(data.urls.config);
                        showStatus('URL di configurazione codificato copiato!', 'success');
                        // Aggiorna anche la visualizzazione
                        document.getElementById('encodedConfigUrl').textContent = data.urls.config;
                    } else {
                        showStatus('Errore nella generazione dell\'URL codificato', 'error');
                    }
                })
                .catch(error => {
                    console.error('Errore:', error);
                    showStatus('Errore nella generazione dell\'URL codificato', 'error');
                });
        }

        function copyProxyUrl() {
            copyToClipboard(document.getElementById('proxyUrl').textContent);
        }

        // Genera URL di configurazione
        function generateConfigUrl() {
            const apiKey = document.getElementById('apiKey').value.trim();
            const channelsText = document.getElementById('channels').value.trim();
            
            if (!apiKey) {
                showStatus('Inserisci prima l\'API Key', 'error');
                return;
            }
            
            const channels = channelsText.split('\\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            const params = new URLSearchParams();
            params.set('apiKey', apiKey);
            if (channels.length > 0) {
                params.set('channels', channels.join('\\n'));
            }
            
            const configUrl = \`\${window.location.origin}/?\${params.toString()}\`;
            document.getElementById('configUrl').textContent = configUrl;
            showStatus('URL di configurazione generato!', 'success');
        }

        // Installa in Stremio
        function installInStremio() {
            const manifestUrl = document.getElementById('manifestUrl').textContent;
            const stremioUrl = \`stremio://\${window.location.host}/manifest.json\`;
            window.open(stremioUrl, '_blank');
            showStatus('Apertura Stremio...', 'success');
        }

        // Gestisce l'invio del form
        document.getElementById('configForm').addEventListener('submit', function(e) {
            e.preventDefault();
            saveConfig();
        });

        // Applica configurazione da URL se presente
        function applyConfigFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const apiKey = urlParams.get('apiKey');
            const channels = urlParams.get('channels');
            
            if (apiKey) {
                document.getElementById('apiKey').value = apiKey;
            }
            if (channels) {
                document.getElementById('channels').value = channels;
            }
            
            // Aggiorna l'URL del manifest dopo aver applicato la configurazione
            updateManifestUrl();
        }

        // Applica configurazione all'avvio se presente negli URL
        applyConfigFromUrl();
        
        // Aggiorna l'URL del manifest quando cambiano i campi
        document.getElementById('apiKey').addEventListener('input', updateManifestUrl);
        document.getElementById('channels').addEventListener('input', updateManifestUrl);
    </script>
</body>
</html>
    `);
});

app.listen(APP_PORT, () => {
	console.log(`OMG YouTube in ascolto su http://0.0.0.0:${APP_PORT}`);
});


