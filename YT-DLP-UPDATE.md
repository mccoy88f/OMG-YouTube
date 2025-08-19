# 🔧 Aggiornamento yt-dlp e Risoluzione Problemi

## 🚨 Problema Comune: Signature Extraction Failed

Se vedi errori come:
```
WARNING: [youtube] YouTube said: ERROR - Precondition check failed.
WARNING: [youtube] eBjRE0xOMlk: Signature extraction failed
ERROR: [youtube] eBjRE0xOMlk: No video formats found!
```

Questo indica che yt-dlp è obsoleto e non riesce più a estrarre i video di YouTube.

## 🔄 Soluzioni

### 1. Aggiornamento Automatico (Docker)
Il Dockerfile ora aggiorna automaticamente yt-dlp all'ultima versione:
```dockerfile
RUN pip3 install --no-cache-dir yt-dlp && \
    yt-dlp -U
```

### 2. Aggiornamento Manuale
Se usi l'addon senza Docker:

#### macOS
```bash
brew upgrade yt-dlp
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt upgrade yt-dlp
```

#### Windows
```bash
pip install --upgrade yt-dlp
```

#### Python (globale)
```bash
pip3 install --upgrade yt-dlp
```

### 3. Verifica Versione
```bash
yt-dlp --version
```

## 🛠️ Opzioni Alternative Implementate

L'addon ora include opzioni alternative per yt-dlp:

- `--extractor-args youtube:player_client=android` - Usa client Android
- `--force-generic-extractor` - Forza estrattore generico
- `--no-check-certificates` - Salta verifica certificati

## 🔄 Fallback Automatico

Se yt-dlp fallisce, l'addon usa automaticamente:
1. **API YouTube** per metadati base
2. **Metadati minimi** generati automaticamente

## 📊 Monitoraggio

Controlla i log per vedere:
- ✅ Versione yt-dlp all'avvio
- 🔄 Tentativi con opzioni alternative
- 📋 Fallback utilizzati

## 🆘 Se il Problema Persiste

1. **Aggiorna yt-dlp** all'ultima versione
2. **Riavvia il container** Docker
3. **Verifica i log** per errori specifici
4. **Controlla la quota API** YouTube

## 💡 Suggerimenti

- Aggiorna yt-dlp **almeno una volta al mese**
- YouTube cambia spesso i sistemi di protezione
- L'addon funziona anche senza yt-dlp (funzionalità limitate)
