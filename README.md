# OMG YouTube (Stremio Addon)

Addon Stremio per cercare e riprodurre video di YouTube usando le API ufficiali di Google (YouTube Data API v3) e yt-dlp per la risoluzione degli URL di streaming. Include una semplice UI admin per inserire API key e canali seguiti.

## Caratteristiche
- Ricerca in Stremio (catalogo "OMG YouTube Search") basata su API ufficiali YouTube
- Canali seguiti in "Canali → OMG YouTube → Canali seguiti" (ultimi 50 video per canale)
- Streaming via `yt-dlp` (best mp4/best disponibile)
- Admin UI su porta 3100 per configurare API key e canali
- Dockerfile e docker-compose pronti all’uso

## Requisiti
- API key YouTube Data API v3
- Docker e Docker Compose

## Avvio rapido
```bash
# Avvia container (porta 3100)
cd "/Users/antonello/Sviluppo/OMG YouTube"
docker compose up --build -d

# Apri l'admin UI
open http://localhost:3100
```

Nella pagina admin:
- Inserisci la tua API key
- Aggiungi i canali (una riga per canale): `Nome[tab o 2+ spazi]URL`

## Installazione su Stremio
- URL manifest: `http://localhost:3100/manifest.json`
- In Stremio: Settings → Addons → Add via URL → incolla l’URL del manifest
- Oppure usa i pulsanti "Copia URL manifest" e "Installa in Stremio" dalla pagina admin

## Endpoint Addon
- Manifest: `/manifest.json`
- Cataloghi:
  - Ricerca: `/catalog/movie/omg-youtube-search/{extra}.json` con `search=...`
  - Canali seguiti: `/catalog/channel/omg-youtube-followed/{extra}.json` con `genre=<Nome canale>`
- Stream: `/stream/:type/:id.json` con `id = yt_<videoId>`

## Configurazione
- Config salvata in `data/config.json` (montata in volume Docker)
- L’admin UI può generare un "URL configurazione" (chiaro o base64) per precompilare i campi quando si apre la pagina
- Nota: l’URL del manifest non include API key o canali (rimangono lato server)

## Docker
- Porta esposta: 3100
- Volume: `./data:/app/data` per persistenza
- `yt-dlp` e `ffmpeg` inclusi nell’immagine

## Sviluppo
```bash
# Avvio senza Docker
npm install
npm run start
# Admin UI su http://localhost:3100
```

## Licenza
MIT
