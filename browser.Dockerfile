FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium socat fonts-noto-core fonts-noto-color-emoji ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -m chrome
USER chrome
ENV TZ=Asia/Jakarta
EXPOSE 9223
CMD ["sh", "-c", "socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222 & exec chromium --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-blink-features=AutomationControlled --lang=id-ID --remote-debugging-port=9222 --user-data-dir=/tmp/chrome about:blank"]
