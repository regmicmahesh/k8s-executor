FROM node:20-alpine AS build

WORKDIR /build

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && \
    pnpm install

COPY . .

RUN pnpm run build && \
    pnpm prune --prod

FROM cgr.dev/chainguard/node:latest as hardened-prod

WORKDIR /app

COPY --from=build /build/dist ./dist
COPY --from=build /build/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

CMD ["dist/index.js"]
