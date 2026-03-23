# Use Python 3.10 as the base image
FROM python:3.10-slim

# Install Node.js (v18) and Google Cloud CLI (gcloud)
RUN apt-get update && apt-get install -y curl apt-transport-https ca-certificates gnupg && \
    # Add Google Cloud repository
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
    # Add Node.js repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    # Install Node.js and Google Cloud CLI
    apt-get update && apt-get install -y nodejs google-cloud-cli && \
    # Clean up
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy Python requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node modules if a package.json exists (optional, safely ignored if not present)
COPY package*.json ./
RUN if [ -f package.json ]; then npm install; fi

# Copy the rest of the application code
COPY . .

# Set default Environment variables 
# Cloud Run automatically sets the PORT environment variable (usually 8080)
ENV PORT=8080

# Create a startup script to run FastAPI, Agent API, and Node.js
RUN echo '#!/bin/bash\n\
    # Start FastAPI backend in the background on port 8000 \n\
    uvicorn src.apis.main:app --host 0.0.0.0 --port 8000 &\n\
    \n\
    # Start Agent API in the background on port 8001 \n\
    cd /app/RAG_Pipeline && PYTHONPATH=/app/RAG_Pipeline uvicorn teacher_agent.server:app --host 0.0.0.0 --port 8001 &\n\
    cd /app\n\
    \n\
    # Start Node.js server in the foreground, binding to $PORT \n\
    exec node server.js\n\
    ' > /app/start.sh && chmod +x /app/start.sh

# Cloud Run / Docker entrypoint
CMD ["/app/start.sh"]
