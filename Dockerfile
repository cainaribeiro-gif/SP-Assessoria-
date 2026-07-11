# Use official lightweight Node.js 20 image for building
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies (including devDependencies required for the build phase)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build both Vite frontend assets and compiled Node/Express server (dist/server.cjs)
RUN npm run build

# Prune development dependencies to keep production image size minimal
RUN npm prune --production

# Final lightweight production runtime stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy built bundles, production node_modules, package.json, and the database file
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/site-data.json ./src/site-data.json

# Expose application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the bundled Express and Vite integration server
CMD ["npm", "start"]
