FROM node:24-alpine
WORKDIR /usr/src/app
COPY package*.json ./
COPY services/core/package.json services/core/package.json
COPY services/incidents/package.json services/incidents/package.json
COPY gateway/package.json gateway/package.json
RUN npm pkg delete scripts.prepare && npm ci --workspace @uptime/gateway --include-workspace-root=false --omit=dev
COPY gateway/src gateway/src
USER node
CMD ["npm", "run", "start", "-w", "@uptime/gateway"]
