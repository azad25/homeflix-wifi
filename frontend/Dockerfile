FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3006

# Set environment variables
ENV NODE_ENV production
ENV PORT 3006
ENV HOSTNAME "0.0.0.0"

# Start the application
CMD ["npm", "run", "dev"]
