# SPA S1. El browser habla REST/WS contra `/station` (mismo origen);
# nginx lo reenvía a la estación. RTP de WebRTC no pasa por acá.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_STATION_URL=/station
ENV VITE_STATION_URL=$VITE_STATION_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
ENV NGINX_ENVSUBST_FILTER=STATION_UPSTREAM
ENV STATION_UPSTREAM=http://127.0.0.1:8090
EXPOSE 5173
