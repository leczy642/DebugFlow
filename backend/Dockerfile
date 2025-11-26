FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code AFTER dependencies
COPY . .

# Expose backend port
EXPOSE 4000

# Default command for production
CMD ["npm", "run", "start"]
