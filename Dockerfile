FROM alpine:3.20 AS typst
RUN apk add --no-cache curl xz \
 && curl -fsSL https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz | tar -xJ -C /tmp \
 && mv /tmp/typst-x86_64-unknown-linux-musl/typst /typst

FROM oven/bun:1.4 AS app
COPY --from=typst /typst /usr/local/bin/typst
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
WORKDIR /app/apps/web
RUN bun -e 'const { createE5Embedder } = await import("nalar"); await (await createE5Embedder()).embed(["siap"]);'
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bun", "src/index.ts"]
