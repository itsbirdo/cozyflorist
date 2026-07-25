FROM node:22-alpine
WORKDIR /srv/guildhq
COPY server.js ./
COPY public ./public
ENV DATA_DIR=/srv/guildhq/data
EXPOSE 8321
USER node
CMD ["node", "server.js"]
