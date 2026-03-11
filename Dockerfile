# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Build the FastAPI Backend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies required for psycopg2 and other packages
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install them
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend directory
COPY backend ./backend

# Copy the built React app from the frontend-builder stage into a "dist" folder at the root
COPY --from=frontend-builder /app/frontend/dist /app/dist

# Set up environment variables
ENV PYTHONPATH=/app/backend
ENV PORT=10000

# Create the uploads directory for QR codes
RUN mkdir -p /app/uploads

# Expose the port Render expects
EXPOSE $PORT

# Copy the startup script
COPY start.sh .
RUN chmod +x start.sh

# Start the application
CMD ["./start.sh"]
