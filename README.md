# OMG YouTube - Addon Stremio

Un addon per Stremio che permette di cercare e riprodurre video di YouTube direttamente nell'app.

## 🚀 Caratteristiche

- **Ricerca Video**: Cerca video su YouTube usando l'API ufficiale
- **Canali Seguiti**: Segui i tuoi canali YouTube preferiti
- **Streaming Diretto**: Riproduci video senza download usando yt-dlp
- **Metadati Completi**: Titoli, descrizioni e informazioni complete sui video
- **Compatibilità Stremio**: Funziona perfettamente con Stremio

## 🔧 Problemi Risolti

### ❌ Problema Precedente
- I metadati non venivano visualizzati quando si entrava nell'elemento del catalogo
- Mancava l'endpoint `/meta` richiesto da Stremio
- yt-dlp non era gestito correttamente

### ✅ Soluzioni Implementate
- **Endpoint `/meta`**: Aggiunto per fornire metadati completi
- **Gestione yt-dlp**: Migliorata con controlli di disponibilità e fallback
- **Fallback API**: Se yt-dlp non è disponibile, usa l'API di YouTube
- **Gestione Errori**: Robusto sistema di fallback per garantire sempre metadati

## 📋 Requisiti

### Obbligatori
- **Node.js** (versione 14 o superiore)
- **API Key Google YouTube** (per ricerca e metadati)

### Opzionali ma Consigliati
- **yt-dlp** (per streaming diretto e metadati completi)

## 🚀 Installazione

### 1. Clona il Repository
```bash
git clone <repository-url>
cd "OMG YouTube"
```

### 2. Installa le Dipendenze
```bash
npm install
```

### 3. Installa yt-dlp (Raccomandato)

#### macOS
```bash
brew install yt-dlp
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install yt-dlp
```

#### Windows
```bash
pip install yt-dlp
```

#### Docker
```bash
docker pull yt-dlp/yt-dlp
```

### 4. Configura l'API Key
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita l'API di YouTube Data v3
4. Crea una chiave API
5. Copia la chiave API

### 5. Avvia l'Addon
```bash
npm start
```

L'addon sarà disponibile su `http://localhost:3100`

## ⚙️ Configurazione

### Interfaccia Web
1. Apri `http://localhost:3100` nel browser
2. Inserisci la tua API Key di Google YouTube
3. Aggiungi i canali che vuoi seguire (uno per riga)
4. Salva la configurazione

### Configurazione per Produzione
Se stai deployando l'addon su un server pubblico, configura il dominio reale:

```bash
# Imposta la variabile d'ambiente con il tuo dominio
export PUBLIC_HOST="https://tuodominio.com:3100"

# Oppure nel Docker Compose
environment:
  - PUBLIC_HOST=https://tuodominio.com:3100
```

Questo è **essenziale** per il corretto funzionamento dello streaming, altrimenti i link saranno generati con `localhost` e non funzioneranno da remoto.

### Configurazione Stremio
1. Copia l'URL del manifest generato
2. In Stremio, vai su Addons → Community Addons
3. Incolla l'URL del manifest
4. L'addon sarà installato e disponibile

## 🔍 Come Funziona

### Ricerca Video
- Usa l'API ufficiale di YouTube per la ricerca
- Restituisce risultati con metadati completi
- Supporta filtri per lingua e regione

### Metadati Video
1. **Prima scelta**: yt-dlp per informazioni complete
2. **Fallback**: API di YouTube per metadati base
3. **Ultimo fallback**: Metadati minimi generati automaticamente

### Streaming
- **Con yt-dlp**: Streaming diretto in tempo reale
- **Senza yt-dlp**: Fallback all'URL diretto di YouTube

## 📁 Struttura del Progetto

```
src/
├── index.js          # Server principale e endpoint
├── lib/
│   ├── config.js     # Gestione configurazione
│   ├── youtube.js    # API YouTube
│   └── yt.js         # Gestione yt-dlp
```

## 🌐 Endpoint API

### Manifest
- `GET /manifest.json` - Manifest dell'addon per Stremio

### Catalogo
- `GET /catalog/:type/:id/:extra?.json` - Catalogo video e canali

### Metadati
- `GET /meta/:type/:id.json` - Metadati completi del video

### Streaming
- `GET /stream/:type/:id.json` - Informazioni sullo stream
- `GET /proxy/:type/:id` - Proxy streaming diretto

### Amministrazione
- `GET /api/config` - Configurazione corrente
- `GET /api/yt-dlp-status` - Stato di yt-dlp
- `POST /api/config` - Salva configurazione

## 🐛 Risoluzione Problemi

### Metadati Non Visualizzati
1. Verifica che yt-dlp sia installato: `yt-dlp --version`
2. Controlla i log del server per errori
3. Verifica che l'API Key sia valida

### Streaming Non Funziona
1. Assicurati che yt-dlp sia installato
2. Controlla la connessione internet
3. Verifica che il video non sia privato o ristretto

### Errori API
1. Verifica che l'API Key sia corretta
2. Controlla i limiti di quota dell'API
3. Assicurati che l'API di YouTube sia abilitata

## 📊 Logging e Debug

### Log Docker Migliorati
L'addon ora include logging dettagliato per facilitare il debug:

- **🎥 Avvio**: Versione yt-dlp e stato iniziale
- **🔍 Ricerche**: Query di ricerca e risultati trovati
- **📋 Metadati**: Richieste meta e fallback utilizzati
- **🎬 Streaming**: URL estratti e formati video
- **🚀 Proxy**: Connessioni client e gestione stream

### Esempi di Log
```
🎥 OMG YouTube Addon Avviato!
✅ yt-dlp disponibile - Versione: 2023.12.30
🔍 Ricerca catalog richiesta: "musica italiana"
✅ Ricerca completata: 25 video trovati
   📹 1. Canzone Italiana (yt_ABC123)
      📺 Canale: Canale Musica
      📅 Data: 2024-01-15T10:30:00Z
🎬 Stream request per video: ABC123
✅ URL stream estratto: https://r4---sn-...
📹 Formato rilevato: MP4
```

## 🔒 Sicurezza

- L'API Key viene passata tramite parametri URL (necessario per Stremio)
- Non vengono salvati dati personali
- Tutte le richieste sono validate

## 📝 Note

- L'addon funziona anche senza yt-dlp, ma con funzionalità limitate
- I metadati vengono sempre forniti, anche se in forma ridotta
- Lo streaming diretto richiede yt-dlp installato

## 🤝 Contributi

Le contribuzioni sono benvenute! Apri una issue o una pull request per migliorare l'addon.

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT.

## 🎨 Attribuzioni

### Icona dell'App
L'icona dell'addon è fornita da [Flaticon](https://www.flaticon.com/free-icon/play_10090287):
- **Icona**: Play button by Freepik
- **Link**: https://www.flaticon.com/free-icon/play_10090287?term=youtube&page=1&position=51&origin=tag&related_id=10090287
- **Autore**: [Freepik](https://www.freepik.com) from [Flaticon](https://www.flaticon.com/)
- **Licenza**: Flaticon License

## 🆘 Supporto

Per problemi o domande:
1. Controlla i log del server
2. Verifica lo stato di yt-dlp nell'interfaccia web
3. Apri una issue su GitHub
