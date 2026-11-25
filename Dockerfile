FROM node:20-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
VOLUME /app/data
EXPOSE 3000
CMD ["npm","start"]
