FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium firefox-esr fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --prefix /opt/browser-tools puppeteer@24.43.1 --ignore-scripts --no-audit --no-fund
ENV NODE_PATH=/opt/browser-tools/node_modules

ENTRYPOINT ["node", "/checks/check-reuse.mjs", "/build"]
