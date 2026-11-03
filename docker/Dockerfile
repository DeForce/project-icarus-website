# Build stage: full toolchain, native module compilation, Nuxt production build.
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: self-contained Nitro output, non-root user.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S icarus && adduser -S icarus -G icarus
COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
USER icarus
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
