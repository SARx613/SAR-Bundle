# Remix + Prisma: build needs devDependencies (Vite, TypeScript, etc.)
FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Full install so `remix vite:build` can run (Vite is a devDependency)
RUN npm ci && npm cache clean --force

COPY . .

# Prisma schema uses env("DATABASE_URL"); generate only needs a syntactically valid URL at build time
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate
RUN npm run build

# Smaller runtime image: drop devDependencies after build
RUN npm prune --omit=dev && npm cache clean --force

CMD ["npm", "run", "docker-start"]
