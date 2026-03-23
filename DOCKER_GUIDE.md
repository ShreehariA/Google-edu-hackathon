# Docker Local Development & Deployment Guide

This guide covers building, running, debugging, and deploying the monolithic Docker container that houses the frontend (Node.js), the main backend (FastAPI), and the Agent backend.

---

## 1. Build the Docker Image
Whenever you change `requirements.txt`, `package.json`, or the `Dockerfile`, you need to rebuild the image:
```bash
docker build -t shreeharia/deltaed-app:latest .
```

---

## 2. Run the Container Locally
Because the app relies on Google Cloud credentials and exposes three different ports, you must run it with several flags:

```bash
docker run -p 3000:8080 -p 8000:8000 -p 8001:8001 \
  --env-file src/.env \
  -v ~/.config/gcloud:/root/.config/gcloud:ro \
  -d shreeharia/deltaed-app:latest
```

**What this command does:**
* `-p 3000:8080`: Maps the Node.js frontend to `localhost:3000`.
* `-p 8000:8000`: Maps the main FastAPI backend to `localhost:8000`.
* `-p 8001:8001`: Maps the Agent API to `localhost:8001`.
* `--env-file src/.env`: Injects your environment variables.
* `-v ~/.config/gcloud...`: Shares your Mac's Google login (`gcloud auth application-default login`) directly into the container so BigQuery and Vertex AI work.
* `-d`: Runs the container in the background (detached).

---

## 3. Debugging (Viewing Logs)
If the frontend says "Could not reach the server" or things look broken, you need to check the Python crash logs.

**Find the Container ID:**
```bash
docker ps
```

**View the live logs:** *(Replace `<CONTAINER_ID>` with your ID)*
```bash
docker logs -f <CONTAINER_ID>
```

---

## 4. Kill and Restart the Container
If you update your `.env` file or change your code (when not using file-syncing volumes), you must kill the old container and start a new one.

This "one-liner" magically finds the currently running container, gracefully kills it, and immediately starts a fresh one:
```bash
docker rm -f $(docker ps -a -q --filter ancestor=shreeharia/deltaed-app:latest) || true && docker run -p 3000:8080 -p 8000:8000 -p 8001:8001 --env-file src/.env -v ~/.config/gcloud:/root/.config/gcloud:ro -d shreeharia/deltaed-app:latest
```

---

## 5. Push to Docker Hub
Once everything is running perfectly locally and you are ready to prepare for Google Cloud Run deployment, push the image to Docker Hub:

```bash
# Ensure you are logged into Docker Hub
docker login

# Push the built image
docker push shreeharia/deltaed-app:latest
```
