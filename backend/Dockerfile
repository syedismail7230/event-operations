# ---- Base Node ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate

# ---- Build ----
FROM dependencies AS build
COPY . .
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=dependencies /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# AWS typically binds to PORT 80 or 8080 depending on the ELB config. Note this in ENV.
ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["npm", "run", "start"]
