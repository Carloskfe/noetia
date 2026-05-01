## ADDED Requirements

### Requirement: Flask service starts and is healthy
The `services/image-gen` directory SHALL contain a runnable Flask application with a `/health` GET endpoint that returns `{ "status": "ok" }` with HTTP 200.

#### Scenario: Health check passes
- **WHEN** the image-gen container is running and a GET request is sent to `/health`
- **THEN** the response is HTTP 200 with body `{ "status": "ok" }`

### Requirement: Template directory structure exists
The `services/image-gen/templates` directory SHALL contain stub Python files for each supported platform: `linkedin.py`, `instagram.py`, `facebook.py`, `whatsapp.py` — each exporting a `render(fragment: dict) -> bytes` function that returns a placeholder PNG.

#### Scenario: Template modules import without error
- **WHEN** Flask starts and imports the templates package
- **THEN** all four template modules load without import errors

### Requirement: Dependencies are declared in requirements.txt
The `services/image-gen/requirements.txt` SHALL list all Python dependencies including Flask, Pillow, and Cairo (pycairo) with pinned versions.

#### Scenario: Dependencies install cleanly
- **WHEN** `pip install -r requirements.txt` is run in a clean Python 3.11 environment
- **THEN** all packages install without conflict errors

### Requirement: Dockerfile builds and runs the service
The `services/image-gen/Dockerfile` SHALL produce an image based on `python:3.11-slim` that installs system dependencies for Cairo (libcairo2), installs Python requirements, and starts the Flask app.

#### Scenario: Docker image builds
- **WHEN** `docker build -t noetia-image-gen .` is run inside `services/image-gen`
- **THEN** the build completes without errors and the container responds to `/health`
