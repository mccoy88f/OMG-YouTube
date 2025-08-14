const axios = require('axios');

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

function pickThumb(thumbnails) {
	if (!thumbnails) return undefined;
	return (
		thumbnails.maxres?.url ||
		thumbnails.standard?.url ||
		thumbnails.high?.url ||
		thumbnails.medium?.url ||
		thumbnails.default?.url
	);
}

function toVideoMeta(item) {
	const id = item.id?.videoId || item.id;
	const snippet = item.snippet || {};
	return {
		videoId: id,
		title: snippet.title || '',
		description: snippet.description || '',
		thumbnail: pickThumb(snippet.thumbnails) || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined),
		channelTitle: snippet.channelTitle || '',
		publishedAt: snippet.publishedAt || ''
	};
}

async function searchVideos({ apiKey, query, maxResults = 50 }) {
	const params = {
		part: 'snippet',
		q: query,
		type: 'video',
		maxResults: Math.min(50, maxResults),
		key: apiKey,
		regionCode: 'IT',
		relevanceLanguage: 'it'
	};
	const { data } = await axios.get(`${YT_API_BASE}/search`, { params });
	return (data.items || []).map(toVideoMeta);
}

async function getChannelIdFromInput({ apiKey, input }) {
	if (!input) return undefined;
	const url = String(input).trim();
	// Try to extract directly
	const channelIdMatch = url.match(/\/channel\/([A-Za-z0-9_-]{10,})/);
	if (channelIdMatch) return channelIdMatch[1];
	const userMatch = url.match(/\/user\/([A-Za-z0-9._-]+)/);
	if (userMatch) {
		const username = userMatch[1];
		const { data } = await axios.get(`${YT_API_BASE}/channels`, {
			params: { part: 'snippet', forUsername: username, key: apiKey }
		});
		return data.items?.[0]?.id;
	}
	const handleMatch = url.match(/\/(?:@)([A-Za-z0-9._-]+)/);
	if (handleMatch) {
		const handle = `@${handleMatch[1]}`;
		const { data } = await axios.get(`${YT_API_BASE}/search`, {
			params: { part: 'snippet', q: handle, type: 'channel', maxResults: 1, key: apiKey }
		});
		return data.items?.[0]?.id?.channelId;
	}
	return undefined;
}

async function fetchChannelTitleAndThumb({ apiKey, channelId }) {
	const { data } = await axios.get(`${YT_API_BASE}/channels`, {
		params: { part: 'snippet', id: channelId, key: apiKey }
	});
	const item = data.items?.[0];
	return {
		channelTitle: item?.snippet?.title || '',
		channelThumbnail: pickThumb(item?.snippet?.thumbnails)
	};
}

async function fetchChannelLatestVideos({ apiKey, channelId, maxResults = 50 }) {
	const params = {
		part: 'snippet',
		channelId,
		order: 'date',
		type: 'video',
		maxResults: Math.min(50, maxResults),
		key: apiKey
	};
	const { data } = await axios.get(`${YT_API_BASE}/search`, { params });
	const base = (data.items || []).map(toVideoMeta);
	// Enrich with channel thumb/title
	const extra = await fetchChannelTitleAndThumb({ apiKey, channelId });
	return base.map((v) => ({ ...v, ...extra }));
}

module.exports = {
	searchVideos,
	getChannelIdFromInput,
	fetchChannelLatestVideos,
	fetchChannelTitleAndThumb
};


