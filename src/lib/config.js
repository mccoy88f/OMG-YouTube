const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

function ensureDataDir() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	if (!fs.existsSync(CONFIG_PATH)) {
		const defaults = { 
			apiKey: '', 
			channels: [], 
			extractionLimit: 25,
			searchMode: 'api' // 'api' or 'ytdlp'
		};
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2));
	}
}

function loadConfig() {
	try {
		const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
		const config = JSON.parse(raw);
		// Assicura che i campi esistano per backward compatibility
		return {
			apiKey: config.apiKey || '',
			channels: config.channels || [],
			extractionLimit: config.extractionLimit || 25,
			searchMode: config.searchMode || 'api'
		};
	} catch (e) {
		return { 
			apiKey: '', 
			channels: [], 
			extractionLimit: 25,
			searchMode: 'api'
		};
	}
}

function saveConfig(config) {
	const toSave = {
		apiKey: String(config.apiKey || '').trim(),
		channels: Array.isArray(config.channels) ? config.channels : [],
		extractionLimit: Math.max(5, Math.min(50, parseInt(config.extractionLimit) || 25)),
		searchMode: config.searchMode === 'ytdlp' ? 'ytdlp' : 'api'
	};
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2));
	return toSave;
}

module.exports = { ensureDataDir, loadConfig, saveConfig, DATA_DIR, CONFIG_PATH };


