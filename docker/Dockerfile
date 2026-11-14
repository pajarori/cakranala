FROM oven/bun:1.4
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates unzip xz-utils fonts-liberation fonts-noto-color-emoji \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 \
 && rm -rf /var/lib/apt/lists/*
ENV CAKRANALA_CACHE=/opt/cakranala CAKRANALA_DATA=/data NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build && bun bin/cakranala.js install
EXPOSE 3000
CMD ["bun", "bin/cakranala.js", "serve"]
