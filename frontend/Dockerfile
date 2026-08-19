ARG NODE_IMAGE=docker.arvancloud.ir/library/node:22-alpine
ARG NGINX_IMAGE=docker.arvancloud.ir/library/nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY package.json ./
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm install --registry="${NPM_REGISTRY}" \
    || npm install --registry="https://registry.npmjs.org"
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM ${NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
