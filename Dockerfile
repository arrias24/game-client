# SPA S1. El browser habla REST/WS contra `/station` (mismo origen);
# nginx lo reenvía a la estación. RTP de WebRTC no pasa por acá.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_STATION_URL=/station
ARG VITE_ICE_SERVERS=stun:stun.l.google.com:19302
ARG VITE_GAME_ID=supertuxkart
ENV VITE_STATION_URL=$VITE_STATION_URL
ENV VITE_ICE_SERVERS=$VITE_ICE_SERVERS
ENV VITE_GAME_ID=$VITE_GAME_ID
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/16-selfsigned-certs.sh /docker-entrypoint.d/16-selfsigned-certs.sh
RUN chmod +x /docker-entrypoint.d/16-selfsigned-certs.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
ENV NGINX_ENVSUBST_FILTER=STATION_UPSTREAM
ENV STATION_UPSTREAM=http://127.0.0.1:8090
ENV PUBLIC_HOST=localhost
EXPOSE 5173 443
