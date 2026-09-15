# Base image
FROM node:20-bookworm-slim

# Copy Metrics source code
COPY . /metrics
WORKDIR /metrics

# Make action executable
RUN chmod +x /metrics/source/app/action/index.mjs

# Install Chrome and system dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    curl \
    unzip \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libx11-xcb1 \
    libxtst6 \
    lsb-release \
    ruby-full \
    git \
    g++ \
    make \
    cmake \
    pkg-config \
    libssl-dev \
    python3 \
  && wget -q \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    -O /tmp/google-chrome.deb \
  && apt-get install -y --no-install-recommends /tmp/google-chrome.deb \
  && rm -f /tmp/google-chrome.deb \
  && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh \
  | DENO_INSTALL=/usr/local sh

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh \
  | DENO_INSTALL=/usr/local sh

# Install Node dependencies and build Metrics
RUN npm ci
RUN npm run build

# Environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_BROWSER_PATH=google-chrome-stable

# Start GitHub Action
ENTRYPOINT ["node", "/metrics/source/app/action/index.mjs"]
