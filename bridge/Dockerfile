FROM node:24.22.1-bookworm-slim
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true CHROMIUM_PATH=/usr/bin/chromium XDG_CONFIG_HOME=/tmp/chromium-config XDG_CACHE_HOME=/tmp/chromium-cache
RUN apt-get update && apt-get install -y --no-install-recommends chromium dumb-init ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/bridge
COPY bridge/package.json bridge/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && mkdir -p /data && chown node:node /data
COPY --chown=node:node bridge/src ./src
COPY --chown=node:node selligate/protocol.ts /app/selligate/protocol.ts
USER node
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init","--"]
CMD ["node","src/index.ts"]
