const { spawn } = require('child_process');

function run(command, args, { timeoutMs = 15000 } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		let finished = false;
		const timer = setTimeout(() => {
			if (!finished) {
				finished = true;
				try { child.kill('SIGKILL'); } catch {}
				reject(new Error('yt-dlp timeout'));
			}
		}, timeoutMs);
		child.stdout.on('data', (d) => { stdout += d.toString(); });
		child.stderr.on('data', (d) => { stderr += d.toString(); });
		child.on('error', (err) => {
			clearTimeout(timer);
			if (!finished) {
				finished = true;
				reject(err);
			}
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (finished) return;
			finished = true;
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(stderr || `Command failed with code ${code}`));
		});
	});
}

async function getStreamUrlForVideo(videoId) {
	if (!videoId) return undefined;
	const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
	// -g to print direct URL, prefer mp4
	const { stdout } = await run('yt-dlp', ['-g', '-f', 'best[ext=mp4]/best', videoUrl], { timeoutMs: 30000 });
	const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	return lines[0];
}

module.exports = { getStreamUrlForVideo };


