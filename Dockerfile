# ---- BASE NODE ----
FROM node:20-slim

# ---- INSTALAR DEPENDÊNCIAS DO CHROMIUM ----
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# ---- VARIÁVEIS DE AMBIENTE ----
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=4000

# ---- CONFIGURAR O DIRETÓRIO ----
WORKDIR /app

# ---- COPIAR DEPENDÊNCIAS ----
COPY package*.json ./
RUN npm install --omit=dev

# ---- COPIAR O RESTANTE DO CÓDIGO ----
COPY . .

# ---- EXPOSE ----
EXPOSE 4000

# ---- COMANDO PADRÃO ----
CMD ["node", "index.js"]
