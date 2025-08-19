FROM node:18-alpine

# Installa dipendenze di sistema
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Installa yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

# Crea directory dell'app
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze Node.js
RUN npm ci --only=production

# Copia il codice sorgente
COPY . .

# Crea directory per i dati
RUN mkdir -p /app/data

# Esponi la porta
EXPOSE 3100

# Comando di avvio
CMD ["npm", "start"]


