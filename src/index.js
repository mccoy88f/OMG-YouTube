const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { loadConfig, saveConfig, ensureDataDir } = require('./lib/config');
const { searchVideos, getChannelIdFromInput, fetchChannelLatestVideos, fetchChannelTitleAndThumb } = require('./lib/youtube');
const { getStreamUrlForVideo } = require('./lib/yt');

const APP_PORT = process.env.PORT ? Number(process.env.PORT) : 3100;

ensureDataDir();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

function buildManifest() {
	const config = loadConfig();
	const channels = config.channels || [];
	const channelNames = channels.map((c) => c.name).filter(Boolean);

	// Costruisci URL di configurazione per Stremio
	const configParams = new URLSearchParams();
	if (config.apiKey) configParams.set('apiKey', config.apiKey);
	if (channels.length > 0) {
		const channelsData = channels.map(c => `${c.name || ''}\t${c.url || ''}`).join('\n');
		configParams.set('channels', channelsData);
	}
	const configUrl = configParams.toString() ? `/?${configParams.toString()}` : '';

	return {
		id: 'omg-youtube',
		version: '1.0.0',
		name: 'OMG YouTube',
		description: 'Cerca video su YouTube e mostra i canali seguiti. Usa yt-dlp per lo streaming diretto.',
		logo: 'https://www.youtube.com/s/desktop/99a30123/img/favicon_144x144.png',
		background: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
		idPrefixes: ['yt_'],
		resources: ['catalog', 'stream'],
		types: ['movie', 'channel'],
		// Aggiungi URL di configurazione per Stremio
		configuration: configUrl ? `http://${process.env.PUBLIC_HOST || 'localhost:3100'}${configUrl}` : undefined,
		catalogs: [
			{
				type: 'movie',
				id: 'omg-youtube-search',
				name: 'OMG YouTube Search',
				extra: [{ name: 'search', isRequired: true }]
			},
			{
				type: 'channel',
				id: 'omg-youtube-followed',
				name: 'Canali seguiti',
				genres: channelNames,
				extra: [{ name: 'genre', isRequired: false }]
			}
		]
	};
}

function parseExtra(extraRaw) {
	if (!extraRaw) return {};
	// extra viene nel formato 'key=value' o 'key=value&k2=v2'
	const params = new URLSearchParams(extraRaw.replace(/\.json$/i, ''));
	const out = {};
	for (const [k, v] of params.entries()) out[k] = v;
	return out;
}

// Manifest
app.get(['/manifest.json', '/manifest'], (req, res) => {
	res.setHeader('Cache-Control', 'no-cache');
	res.json(buildManifest());
});

// Catalog
app.get('/catalog/:type/:id/:extra?.json', async (req, res) => {
	const { type, id } = req.params;
    const extra = { ...req.query, ...parseExtra(req.params.extra) };
	const config = loadConfig();
	const apiKey = config.apiKey;
	if (!apiKey) {
		return res.json({ metas: [] });
	}

	try {
		if (id === 'omg-youtube-search' && type === 'movie') {
			const query = (extra.search || '').trim();
			if (!query) return res.json({ metas: [] });
			const results = await searchVideos({ apiKey, query, maxResults: 50 });
			const metas = results.map((r) => ({
				id: `yt_${r.videoId}`,
				type: 'movie',
				name: r.title,
				description: r.description,
				poster: r.thumbnail,
				posterShape: 'landscape',
				logo: r.channelThumbnail || undefined,
				background: r.thumbnail
			}));
			return res.json({ metas });
		}

		if (id === 'omg-youtube-followed' && type === 'channel') {
			const chosen = (extra.genre || '').trim();
			if (!chosen) {
				// Se non è specificato un canale, restituisci la lista dei canali disponibili
				// Stremio può mostrare questo come "seleziona un canale"
				const availableChannels = channels.map((c) => ({
					id: `genre_${c.name}`,
					type: 'channel',
					name: c.name,
					description: `Canale: ${c.url}`,
					poster: c.channelThumbnail || 'https://www.youtube.com/s/desktop/99a30123/img/favicon_144x144.png',
					posterShape: 'landscape'
				}));
				return res.json({ metas: availableChannels });
			}
			
			const channel = channels.find((c) => c.name === chosen);
			if (!channel) return res.json({ metas: [] });
			
			const channelId = channel.channelId || (await getChannelIdFromInput({ apiKey, input: channel.url }));
			if (!channelId) return res.json({ metas: [] });
			
			const videos = await fetchChannelLatestVideos({ apiKey, channelId, maxResults: 50 });
			const metas = videos.map((r) => ({
				id: `yt_${r.videoId}`,
				type: 'channel',
				name: r.title,
				description: r.description,
				poster: r.thumbnail,
				posterShape: 'landscape',
				logo: r.channelThumbnail || undefined,
				background: r.thumbnail
			}));
			return res.json({ metas });
		}

		return res.json({ metas: [] });
	} catch (err) {
		console.error('Catalog error:', err.message);
		return res.json({ metas: [] });
	}
});

// Stream
app.get('/stream/:type/:id.json', async (req, res) => {
	const { id } = req.params;
	const videoId = String(id || '').replace(/^yt_/i, '');
	if (!videoId) return res.json({ streams: [] });
	try {
		const url = await getStreamUrlForVideo(videoId);
		if (!url) return res.json({ streams: [] });
		return res.json({
			streams: [
				{
					url,
					title: 'OMG YouTube'
				}
			]
		});
	} catch (err) {
		console.error('Stream error:', err.message);
		return res.json({ streams: [] });
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

// Simple frontend
app.get('/', (req, res) => {
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	const manifestUrl = `${req.protocol}://${req.get('host')}/manifest.json`;
	res.end(`<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OMG YouTube - Admin</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; margin: 0; color: #111; background: #fafafa; }
    .container { max-width: 860px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .sub { color: #555; margin-bottom: 24px; }
    input, textarea, button { font-size: 16px; }
    .card { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); margin-bottom: 16px; }
    .row { margin-bottom: 16px; }
    label { display: block; margin-bottom: 6px; font-weight: 600; }
    input[type="text"] { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; }
    textarea { width: 100%; height: 180px; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; }
    .hint { color: #666; font-size: 14px; }
    .ok { color: #0a7; }
    .err { color: #c00; }
    code { background: #f2f2f2; padding: 2px 6px; border-radius: 4px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { appearance: none; border: 0; border-radius: 10px; padding: 10px 14px; background: #111; color: #fff; cursor: pointer; }
    .btn.secondary { background: #333; }
    .btn.ghost { background: #fff; color: #111; border: 1px solid #ddd; }
    .muted { color: #777; }
  </style>
  <script>
    async function loadConfig() {
      // Prima applica i dati dall'URL (se presenti)
      try { applyConfigFromUrl(); } catch {}
      
      // Poi carica dal server solo se non ci sono dati nell'URL
      if (!document.getElementById('apiKey').value || !document.getElementById('channels').value) {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (!document.getElementById('apiKey').value) document.getElementById('apiKey').value = data.apiKey || '';
        if (!document.getElementById('channels').value) {
          const lines = (data.channels || []).map(c => (c.name || '') + '\\t' + (c.url || ''));
          document.getElementById('channels').value = lines.join('\\n');
        }
      }
      refreshManifestUi();
    }
    async function saveConfig(e) {
      e.preventDefault();
      const apiKey = document.getElementById('apiKey').value.trim();
      const raw = document.getElementById('channels').value.trim();
      const channels = raw ? raw.split(/\\n+/).map(line => {
        const parts = line.split(/\\t|\\s{2,}/).map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) return { name: parts[0], url: parts[1] };
        if (parts.length === 1) return { name: '', url: parts[0] };
        return null;
      }).filter(c => c && c.url) : [];
      
      // Salva sul server per persistenza
      const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, channels }) });
      const data = await res.json();
      
      const out = document.getElementById('status');
      if (data && (data.apiKey !== undefined || data.channels !== undefined)) {
        out.textContent = 'Salvato e manifest aggiornato.';
        out.className = 'ok';
        // Ricarica i campi dalla risposta
        if (typeof data.apiKey === 'string') document.getElementById('apiKey').value = data.apiKey;
        if (Array.isArray(data.channels)) {
          const lines = data.channels.map(c => (c.name ? (c.name + '\\t' + (c.url||'')) : (c.url||'')));
          document.getElementById('channels').value = lines.join('\\n');
        }
      } else {
        out.textContent = 'Errore nel salvataggio';
        out.className = 'err';
      }
      setTimeout(()=>{ out.textContent=''; out.className=''; }, 3000);
      
      // Aggiorna il manifest con i nuovi dati
      refreshManifestUi();
    }
    function getOrigin() { return window.location.origin; }
    function getManifestUrl() { return getOrigin() + '/manifest.json'; }
    // Mostra anche un URL di catalog per test rapidi (search)
    function getExampleSearchUrl() { return getOrigin() + '/catalog/movie/omg-youtube-search/search=%7Bquery%7D.json'; }
    function refreshManifestUi() {
      const url = getManifestUrl();
      document.getElementById('manifestUrl').textContent = url;
      document.getElementById('manifestUrl').setAttribute('data-url', url);
      // Mostra solo l'URL del manifest, non concatenato con l'esempio
      document.getElementById('manifestUrlInput').value = url;
      // Mostra l'esempio del catalog search in un campo separato
      document.getElementById('catalogExample').textContent = getExampleSearchUrl();
      
      // Aggiorna anche l'URL di configurazione per Stremio
      const apiKey = document.getElementById('apiKey').value.trim();
      const channelsRaw = document.getElementById('channels').value.trim();
      if (apiKey || channelsRaw) {
        const params = new URLSearchParams();
        if (apiKey) params.set('apiKey', apiKey);
        if (channelsRaw) params.set('channels', channelsRaw);
        const configUrl = getOrigin() + '/?' + params.toString();
        document.getElementById('stremioConfigUrl').textContent = configUrl;
      } else {
        document.getElementById('stremioConfigUrl').textContent = 'Nessuna configurazione';
      }
    }
    async function copyManifest() {
      const url = document.getElementById('manifestUrl').getAttribute('data-url');
      try { await navigator.clipboard.writeText(url); notify('Copiato.'); } catch (e) { fallbackCopy(url); }
    }
    function installInStremio() {
      const url = document.getElementById('manifestUrl').getAttribute('data-url');
      const stremioProto = 'stremio://'+ encodeURIComponent(url);
      const webUrl = 'https://web.stremio.com/#/addons/community?addonUrl=' + encodeURIComponent(url);
      const a = document.createElement('a'); a.href = stremioProto; document.body.appendChild(a); a.click();
      setTimeout(() => { window.open(webUrl, '_blank'); }, 500);
    }
    function fallbackCopy(text) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); notify('Copiato.');
    }
    function notify(msg) {
      const out = document.getElementById('status'); out.textContent = msg; out.className = 'ok'; setTimeout(()=>{ out.textContent=''; out.className=''; }, 1800);
    }
    function generateConfigUrl(base64 = false) {
      const apiKey = document.getElementById('apiKey').value.trim();
      const channelsRaw = document.getElementById('channels').value.trim();
      const base = getOrigin();
      const params = new URLSearchParams();
      if (apiKey) params.set('apiKey', apiKey);
      if (channelsRaw) {
        if (base64) params.set('channels_b64', btoa(unescape(encodeURIComponent(channelsRaw))));
        else params.set('channels', channelsRaw.replace(/\\n/g, '\\\\n'));
      }
      const url = base + '/?' + params.toString();
      document.getElementById('configUrl').value = url;
      return url;
    }
    function applyConfigFromUrl() {
      const qs = new URLSearchParams(window.location.search);
      const apiKey = qs.get('apiKey');
      const channelsB64 = qs.get('channels_b64');
      const channelsPlain = qs.get('channels');
      if (apiKey) document.getElementById('apiKey').value = apiKey;
      if (channelsB64) { try { const decoded = decodeURIComponent(escape(atob(channelsB64))); document.getElementById('channels').value = decoded; } catch {} }
      else if (channelsPlain) { document.getElementById('channels').value = channelsPlain.replace(/\\\\n/g, '\\n'); }
    }
    window.addEventListener('DOMContentLoaded', () => { loadConfig(); });
  </script>
  </head>
<body>
  <div class="container">
    <h1>OMG YouTube</h1>
    <div class="sub">Addon Stremio per cercare e riprodurre video di YouTube via yt-dlp</div>

    <div class="card">
      <div class="row">
        <div><strong>URL manifest (per Stremio)</strong></div>
        <div class="hint" style="margin: 8px 0;">
          <code id="manifestUrl" data-url="${manifestUrl}">${manifestUrl}</code>
        </div>
        <div class="actions">
          <button class="btn" type="button" onclick="copyManifest()">Copia URL manifest</button>
          <button class="btn secondary" type="button" onclick="installInStremio()">Installa in Stremio</button>
        </div>
        <input id="manifestUrlInput" type="text" class="muted" readonly style="margin-top:10px; width:100%;" />
        <div class="hint" style="margin-top:8px;">
          <strong>Esempio catalog search:</strong> <code id="catalogExample"></code>
        </div>
        <div class="hint" style="margin-top:8px;">
          <strong>URL configurazione per Stremio:</strong> <code id="stremioConfigUrl"></code>
        </div>
      </div>
    </div>

    <form class="card" onsubmit="saveConfig(event)">
      <div class="row">
        <label for="apiKey">Google API key</label>
        <input id="apiKey" type="text" placeholder="AIza..." />
      </div>
      <div class="row">
        <label for="channels">Canali seguiti (una riga per canale: NOME[tab o 2+ spazi]URL)</label>
        <textarea id="channels" placeholder="Nome Canale\\thttps://www.youtube.com/@canale"></textarea>
        <div class="hint">Esempio: <code>Fireship\\thttps://www.youtube.com/@Fireship</code></div>
      </div>
      <div class="actions">
        <button class="btn" type="submit">Salva</button>
        <span id="status" style="align-self:center;"></span>
      </div>
    </form>

    <div class="card">
      <div class="row">
        <div><strong>URL configurazione (NON per Stremio)</strong></div>
        <div class="hint">Questo URL include le impostazioni correnti (API key e canali) per condividerle/ricaricarle su questa pagina admin. <strong>NON va installato in Stremio</strong> - usa solo l'URL manifest sopra.</div>
      </div>
      <div class="actions">
        <button class="btn ghost" type="button" onclick="generateConfigUrl(false)">Genera URL (chiaro)</button>
        <button class="btn ghost" type="button" onclick="generateConfigUrl(true)">Genera URL (base64)</button>
      </div>
      <input id="configUrl" type="text" class="muted" readonly style="margin-top:10px; width:100%;" />
    </div>
  </div>
</body>
</html>`);
});

app.listen(APP_PORT, () => {
	console.log(`OMG YouTube in ascolto su http://0.0.0.0:${APP_PORT}`);
});


