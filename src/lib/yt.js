const { spawn } = require('child_process');
const { Readable } = require('stream');

/**
 * Estrae l'URL dello stream diretto per un video YouTube
 * @param {string} videoId - ID del video YouTube
 * @returns {Promise<string>} URL dello stream
 */
async function getStreamUrlForVideo(videoId) {
    return new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
            '-g',
            '-f', 'best[ext=mp4]/best',
            `https://www.youtube.com/watch?v=${videoId}`
        ]);

        let stdout = '';
        let stderr = '';

        ytDlp.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytDlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytDlp.on('close', (code) => {
            if (code === 0) {
                const url = stdout.trim().split('\n')[0];
                if (url && url.startsWith('http')) {
                    resolve(url);
                } else {
                    reject(new Error('URL non valido estratto da yt-dlp'));
                }
            } else {
                reject(new Error(`yt-dlp fallito con codice ${code}: ${stderr}`));
            }
        });

        ytDlp.on('error', (error) => {
            reject(new Error(`Errore nell'esecuzione di yt-dlp: ${error.message}`));
        });
    });
}

/**
 * Crea uno stream proxy per un video YouTube
 * @param {string} videoId - ID del video YouTube
 * @returns {Promise<Readable>} Stream leggibile
 */
async function createVideoStream(videoId) {
    return new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
            '-f', 'best[ext=mp4]/best',
            '-o', '-', // Output su stdout
            `https://www.youtube.com/watch?v=${videoId}`
        ]);

        // Crea uno stream leggibile che inoltra i dati di yt-dlp
        const stream = new Readable({
            read() {
                // yt-dlp gestisce automaticamente la lettura
            }
        });

        // Inoltra i dati da yt-dlp allo stream
        ytDlp.stdout.on('data', (chunk) => {
            if (!stream.push(chunk)) {
                // Se lo stream è saturo, pausa yt-dlp
                ytDlp.stdout.pause();
            }
        });

        // Gestisce la fine dello stream
        ytDlp.stdout.on('end', () => {
            stream.push(null);
        });

        // Gestisce gli errori
        ytDlp.stderr.on('data', (data) => {
            console.error(`yt-dlp stderr: ${data}`);
        });

        ytDlp.on('error', (error) => {
            stream.destroy(error);
        });

        ytDlp.on('close', (code) => {
            if (code !== 0) {
                stream.destroy(new Error(`yt-dlp fallito con codice ${code}`));
            }
        });

        // Gestisce la ripresa dello stream
        stream.on('resume', () => {
            ytDlp.stdout.resume();
        });

        resolve(stream);
    });
}

/**
 * Ottiene informazioni sui formati disponibili per un video
 * @param {string} videoId - ID del video YouTube
 * @returns {Promise<Object>} Informazioni sui formati
 */
async function getVideoFormats(videoId) {
    return new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
            '--dump-json',
            `https://www.youtube.com/watch?v=${videoId}`
        ]);

        let stdout = '';
        let stderr = '';

        ytDlp.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytDlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytDlp.on('close', (code) => {
            if (code === 0) {
                try {
                    const info = JSON.parse(stdout);
                    resolve(info);
                } catch (error) {
                    reject(new Error(`Errore nel parsing JSON: ${error.message}`));
                }
            } else {
                reject(new Error(`yt-dlp fallito con codice ${code}: ${stderr}`));
            }
        });

        ytDlp.on('error', (error) => {
            reject(new Error(`Errore nell'esecuzione di yt-dlp: ${error.message}`));
        });
    });
}

module.exports = {
    getStreamUrlForVideo,
    createVideoStream,
    getVideoFormats
};


