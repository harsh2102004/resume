FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

RUN mkdir -p storage/uploads/resumable public/uploads/hls public/uploads/storyboards public/temp \
    && chown -R node:node /usr/src/app

USER node

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/v1/healthcheck || exit 1

CMD ["npm", "start"]
