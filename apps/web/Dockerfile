FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared packages/shared
RUN npm install
COPY apps/web apps/web
RUN npm run build -w packages/shared && npm run build -w apps/web
CMD ["npm", "run", "start", "-w", "apps/web"]
