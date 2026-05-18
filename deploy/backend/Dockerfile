# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps

WORKDIR /app

COPY apps/backend/package*.json ./
RUN npm install

FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/backend/package*.json ./
COPY apps/backend/ ./

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY apps/backend/package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
