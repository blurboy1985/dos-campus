FROM node:24-bookworm-slim
WORKDIR /app
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/campus.sqlite
EXPOSE 3000
CMD ["node", "server.js"]
