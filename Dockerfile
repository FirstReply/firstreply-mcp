# FirstReply MCP server for Cloud Run: the stateless HTTP entry point (https://mcp.firstreply.ai).
# For stdio (Claude Desktop, Claude Code) run the package instead: npx @firstreply/mcp

FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json build-web.mjs ./
COPY src/ ./src/
COPY test/ ./test/
COPY web/ ./web/
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/dist/src ./dist/src
COPY --from=builder /app/web/dist ./web/dist
COPY public/ ./public/
USER node
EXPOSE 8080
CMD ["node", "dist/src/http-server.js"]
