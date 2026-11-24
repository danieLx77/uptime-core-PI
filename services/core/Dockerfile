FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /usr/src/app
COPY package*.json ./
COPY services/core/package.json services/core/package.json
COPY services/incidents/package.json services/incidents/package.json
COPY gateway/package.json gateway/package.json
RUN npm pkg delete scripts.prepare && npm ci --workspace @uptime/core --include-workspace-root=false
COPY services/core services/core
RUN npm run db:generate -w @uptime/core
USER node
CMD ["npm", "run", "start", "-w", "@uptime/core"]
