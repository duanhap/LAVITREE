FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# BUG-46: npm ci cài đúng phiên bản trong package-lock.json
RUN npm ci

COPY . .
RUN npm run build

# BUG-46: nginx chạy bằng user thường (UID 101), nghe cổng 8080 thay vì 80
FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
