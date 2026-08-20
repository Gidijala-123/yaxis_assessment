FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared packages/shared
RUN npm install
COPY apps/api apps/api
RUN npm run build -w packages/shared && npx prisma generate --schema apps/api/prisma/schema.prisma && npm run build -w apps/api
CMD ["sh", "-c", "npx prisma db push --schema apps/api/prisma/schema.prisma && npm run prisma:seed -w apps/api && npm run start -w apps/api"]
