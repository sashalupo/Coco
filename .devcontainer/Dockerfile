FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install additional tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    ripgrep \
    && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /workspace

# Copy package.json for caching dependencies
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source
COPY . .

# Make the workspace accessible to the node user
RUN chown -R node:node /workspace
