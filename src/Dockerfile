FROM python:3.12-slim

WORKDIR /app

# Install uv (the fastest python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy the dependency management files
COPY pyproject.toml ./
COPY uv.lock* ./

# Install the dependencies directly into the system python environment
RUN uv pip install --system -r pyproject.toml

# Copy all the source code into the container
COPY . .

# Set the port (Google Cloud Native often uses 8080 or 8000)
ENV PORT=8000
EXPOSE 8000

# Start the FastAPI native production server
CMD ["fastapi", "run", "apis/main.py", "--port", "8000", "--host", "0.0.0.0"]
