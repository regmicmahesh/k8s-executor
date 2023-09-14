FROM node:20-alpine AS build

WORKDIR /build

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && \
    pnpm install

COPY . .

RUN pnpm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=build /build/dist ./dist
COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && \
    pnpm install --production && \
    pnpm prune --prod

CMD ["node", "dist/index.js"]


FROM cgr.dev/chainguard/node:latest

WORKDIR /app

COPY --from=build /build/dist ./dist
COPY --from=build /build/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

CMD ["dist/index.js"]

