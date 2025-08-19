const { spawn } = require('child_process');
const { Readable } = require('stream');

/**
 * Verifica se yt-dlp è installato e disponibile
 * @returns {Promise<boolean>} True se yt-dlp è disponibile
 */
async function checkYtDlpAvailable() {
    return new Promise((resolve) => {
        const ytDlp = spawn('yt-dlp', ['--version']);
        
        let version = '';
        
        ytDlp.stdout.on('data', (data) => {
            version += data.toString();
        });
        
        ytDlp.on('error', () => {
            console.log('❌ yt-dlp non disponibile nel sistema');
            resolve(false);
        });
        
        ytDlp.on('close', (code) => {
            if (code === 0) {
                const cleanVersion = version.trim();
                console.log(`✅ yt-dlp disponibile - Versione: ${cleanVersion}`);
                resolve(true);
            } else {
                console.log('❌ yt-dlp non disponibile nel sistema');
                resolve(false);
            }
        });
        
        // Timeout dopo 5 secondi
        setTimeout(() => {
            ytDlp.kill();
            console.log('❌ Timeout nel controllo di yt-dlp');
            resolve(false);
        }, 5000);
    });
}

/**
 * Estrae l'URL dello stream diretto per un video YouTube
 * @param {string} videoId - ID del video YouTube
 * @returns {Promise<string>} URL dello stream
 */
async function getStreamUrlForVideo(videoId) {
    const isAvailable = await checkYtDlpAvailable();
    if (!isAvailable) {
        throw new Error('yt-dlp non è installato o non disponibile');
    }

    console.log(`🔍 Estrazione URL stream per video: ${videoId}`);

    return new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
            '-g',
            '-f', 'best[ext=mp4]/best[height<=1080]/best',
            '--no-playlist',
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
                    console.log(`✅ URL stream estratto: ${url}`);
                    console.log(`📹 Formato rilevato: ${url.includes('.mp4') ? 'MP4' : url.includes('.webm') ? 'WebM' : 'Altro'}`);
                    resolve(url);
                } else {
                    console.log(`❌ URL non valido estratto: ${url}`);
                    reject(new Error('URL non valido estratto da yt-dlp'));
                }
            } else {
                console.log(`❌ yt-dlp fallito con codice ${code}: ${stderr}`);
                reject(new Error(`yt-dlp fallito con codice ${code}: ${stderr}`));
            }
        });

        ytDlp.on('error', (error) => {
            console.log(`❌ Errore nell'esecuzione di yt-dlp: ${error.message}`);
            reject(new Error(`Errore nell'esecuzione di yt-dlp: ${error.message}`));
        });

        // Timeout dopo 30 secondi
        setTimeout(() => {
            ytDlp.kill();
            console.log(`⏰ Timeout nell'estrazione dell'URL per video: ${videoId}`);
            reject(new Error('Timeout nell\'estrazione dell\'URL'));
        }, 30000);
    });
}

/**
 * Crea uno stream proxy per un video YouTube
 * @param {string} videoId - ID del video YouTube
 * @returns {Promise<Readable>} Stream leggibile
 */
async function createVideoStream(videoId) {
    const isAvailable = await checkYtDlpAvailable();
    if (!isAvailable) {
        throw new Error('yt-dlp non è installato o non disponibile');
    }

    console.log(`🎬 Creazione stream proxy per video: ${videoId}`);

    return new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
            '-f', 'best[ext=mp4]/best[height<=1080]/best',
            '-o', '-', // Output su stdout
            '--no-playlist',
            '--no-cache-dir',
            `https://www.youtube.com/watch?v=${videoId}`
        ]);

        console.log(`🚀 yt-dlp avviato per streaming: ${videoId}`);

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
            console.log(`✅ Stream completato per video: ${videoId}`);
            stream.push(null);
        });

        // Gestisce gli errori
        ytDlp.stderr.on('data', (data) => {
            console.log(`📝 yt-dlp stderr per ${videoId}: ${data.toString().trim()}`);
        });

        ytDlp.on('error', (error) => {
            console.log(`❌ Errore yt-dlp per ${videoId}: ${error.message}`);
            stream.destroy(error);
        });

        ytDlp.on('close', (code) => {
            if (code !== 0) {
                console.log(`❌ yt-dlp chiuso con codice ${code} per video: ${videoId}`);
                stream.destroy(new Error(`yt-dlp fallito con codice ${code}`));
            } else {
                console.log(`✅ yt-dlp completato con successo per video: ${videoId}`);
            }
        });

        // Gestisce la ripresa dello stream
        stream.on('resume', () => {
            ytDlp.stdout.resume();
        });

        // Timeout per lo stream
        const timeout = setTimeout(() => {
            console.log(`⏰ Timeout stream per video: ${videoId}`);
            ytDlp.kill();
            stream.destroy(new Error('Timeout nello stream del video'));
        }, 300000); // 5 minuti

        stream.on('close', () => {
            clearTimeout(timeout);
            ytDlp.kill();
            console.log(`🔒 Stream chiuso per video: ${videoId}`);
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
    const isAvailable = await checkYtDlpAvailable();
    if (!isAvailable) {
        throw new Error('yt-dlp non è installato o non disponibile');
    }

    console.log(`🔍 Recupero formati per video: ${videoId}`);

    return new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
            '--dump-json',
            '--no-playlist',
            '--no-cache-dir',
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
                    console.log(`✅ Formati recuperati per ${videoId}:`);
                    console.log(`   📹 Titolo: ${info.title || 'N/A'}`);
                    console.log(`   ⏱️ Durata: ${info.duration_string || 'N/A'}`);
                    console.log(`   📊 Formati disponibili: ${info.formats ? info.formats.length : 0}`);
                    console.log(`   🎯 Formato selezionato: ${info.format || 'N/A'}`);
                    console.log(`   🔗 URL: ${info.url || 'N/A'}`);
                    
                    // Mostra i formati migliori disponibili
                    if (info.formats && info.formats.length > 0) {
                        const bestFormats = info.formats
                            .filter(f => f.ext === 'mp4' || f.ext === 'webm')
                            .sort((a, b) => (b.height || 0) - (a.height || 0))
                            .slice(0, 3);
                        
                        console.log(`   🏆 Migliori formati disponibili:`);
                        bestFormats.forEach((f, i) => {
                            console.log(`      ${i + 1}. ${f.ext?.toUpperCase()} - ${f.height}p - ${f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + 'MB' : 'N/A'}`);
                        });
                    }
                    
                    resolve(info);
                } catch (error) {
                    console.log(`❌ Errore nel parsing JSON per ${videoId}: ${error.message}`);
                    reject(new Error(`Errore nel parsing JSON: ${error.message}`));
                }
            } else {
                console.log(`❌ yt-dlp fallito con codice ${code} per ${videoId}: ${stderr}`);
                reject(new Error(`yt-dlp fallito con codice ${code}: ${stderr}`));
            }
        });

        ytDlp.on('error', (error) => {
            console.log(`❌ Errore nell'esecuzione di yt-dlp per ${videoId}: ${error.message}`);
            reject(new Error(`Errore nell'esecuzione di yt-dlp: ${error.message}`));
        });

        // Timeout dopo 30 secondi
        setTimeout(() => {
            ytDlp.kill();
            console.log(`⏰ Timeout nel recupero formati per video: ${videoId}`);
            reject(new Error('Timeout nel recupero delle informazioni del video'));
        }, 30000);
    });
}

module.exports = {
    checkYtDlpAvailable,
    getStreamUrlForVideo,
    createVideoStream,
    getVideoFormats
};


