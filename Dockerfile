FROM oven/bun:1.4 AS app
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
WORKDIR /app/apps/web
RUN bun -e 'const { createE5Embedder } = await import("@cakranala/embed-e5"); await (await createE5Embedder()).embed(["siap"]);'
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bun", "src/index.ts"]
