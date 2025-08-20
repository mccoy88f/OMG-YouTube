# 🔧 Risoluzione Problemi Quota YouTube API

## 📊 Problema Identificato: Quota Esaurita

L'errore **403 - quotaExceeded** indica che hai superato la quota giornaliera della tua API Key YouTube.

### 📈 Dettagli Quota YouTube Data API v3

- **Quota Giornaliera Gratuita**: 10.000 unità/giorno
- **Reset Quota**: Automatico ogni 24 ore (mezzanotte PST)
- **Costo Ricerca**: 100 unità per ogni ricerca
- **Costo Metadati Video**: 1-5 unità per video

## 🚀 Soluzioni Immediate

### 1. **Aspettare il Reset (Soluzione Gratuita)**
La quota si resetta automaticamente ogni 24 ore. Prova di nuovo domani.

### 2. **Creare Nuova API Key (Soluzione Rapida)**

#### Passaggi:
1. **Vai su [Google Cloud Console](https://console.cloud.google.com/)**
2. **Crea un nuovo progetto** (o seleziona un progetto esistente)
3. **Abilita YouTube Data API v3**:
   - Vai su "API e servizi" → "Libreria"
   - Cerca "YouTube Data API v3"
   - Clicca "ABILITA"
4. **Crea credenziali**:
   - Vai su "API e servizi" → "Credenziali"
   - Clicca "CREA CREDENZIALI" → "Chiave API"
   - Copia la nuova API Key
5. **Configura l'addon** con la nuova API Key

### 3. **Richiedere Aumento Quota (Soluzione a Lungo Termine)**

Per progetti commerciali o ad alto traffico:
- Vai su Google Cloud Console
- Richiedi aumento quota nella sezione "Quote"
- Considera l'upgrade a un piano a pagamento

## 🔧 Ottimizzazioni Implementate

### ✅ Miglioramenti Aggiunti al Codice

1. **Gestione Errori Migliorata**:
   - Riconoscimento automatico errori quota
   - Messaggi di errore specifici e utili
   - Distinzione tra errori di quota e altri errori

2. **Controllo Quota Efficiente**:
   - Nuovo endpoint `/api/check-quota` (consumo minimo: 1 unità)
   - Prevenzione richieste costose quando quota è esaurita

3. **Logging Dettagliato**:
   - Tracciamento del consumo quota
   - Suggerimenti automatici in caso di errore

### 🛠 Nuove Funzionalità

- **Endpoint Quota Check**: `POST /api/check-quota`
- **Gestione Errori Specifica**: Distinzione tra quota esaurita, API Key invalida, errori di rete
- **Messaggi User-Friendly**: Istruzioni chiare su come risolvere ogni tipo di errore

## 📱 Test Rapido Quota

```bash
# Testa la tua API Key direttamente
curl -X POST http://localhost:3100/api/check-quota \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"TUA_API_KEY_QUI"}'
```

## 🎯 Raccomandazioni per Uso Efficiente

### Per Ridurre Consumo Quota:
1. **Limita le Ricerche**: Usa il parametro `extractionLimit` più basso
2. **Cache Locale**: Considera l'implementazione di una cache per risultati frequenti
3. **Ricerche Specifiche**: Evita ricerche troppo generiche
4. **Monitoraggio**: Traccia il consumo giornaliero

### Best Practices:
- **API Key Separata**: Usa API Key diverse per sviluppo e produzione
- **Backup API Key**: Mantieni sempre una API Key di backup
- **Monitoraggio**: Controlla regolarmente l'uso quota nel Google Cloud Console

## 🚨 Prossimi Passi

1. **Immediato**: Usa una nuova API Key per continuare i test
2. **Breve termine**: Implementa monitoraggio quota
3. **Lungo termine**: Considera upgrade piano o ottimizzazioni cache

---

**📞 Supporto**: Se hai bisogno di aiuto, controlla i log dettagliati del server per messaggi specifici di errore.

