# CrowdVision: Predictive Crowd Intelligence & Agentic Monitoring

CrowdVision is an intelligent crowd monitoring and predictive spatial safety platform. It integrates computer vision analytics (YOLO person detection, ByteTrack multi-object tracking, and perspective-calibrated zone mapping) with an independent analytical AI Agent to forecast overcrowding risks and recommend mitigation actions.

---

## Key System Capabilities

- **Video & Stream Ingestion**: Process uploaded CCTV and drone recordings with automated perspective geometry classification.
- **Computer Vision Pipeline**: Real-time person detection, ground-contact point mapping, velocity tracking, and density estimation.
- **Predictive Heatmaps**: Short-term spatial crowd density forecasting across user-defined venue zones.
- **Independent AI Agent**: Deterministic risk assessment engine (hysteresis, multi-horizon forecasts, and alert throttling) paired with offline LLM fallback.
- **Interactive Web Console**: React & Vite frontend for real-time task management, zone drawing, telemetry charts, and live alerts.

---

## Repository Layout

```
.
├── backend/            # FastAPI analytics server, CV engine & SQLite/PostgreSQL storage
├── ai_agent/           # Independent crowd management AI agent & risk interpreter
├── frontend/           # React 19, TypeScript, Tailwind CSS, & Vite operator UI
├── .github/workflows/  # Continuous integration test pipelines
├── requirements.txt    # Unified root Python dependency manifest
├── SECURITY.md         # Vulnerability reporting & security architecture
└── CONTRIBUTING.md     # Guidelines for developers and researchers
```

---

## Quickstart

### 1. Environment Setup

Copy example environment configurations:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp ai_agent/.env.example ai_agent/.env
```

Install backend and agent dependencies:
```bash
pip install -r requirements.txt
```

### 2. Run the Backend Service
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Run the AI Agent Service
```bash
cd ai_agent
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Run the Operator Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Automated Verification & Testing

Both subsystems include complete automated unit, integration, and security test suites:

```bash
# Run backend tests (26 passing tests)
$env:PYTHONPATH="backend"; pytest -p pytest_asyncio.plugin backend/tests/ -v

# Run AI agent tests (33 passing tests)
$env:PYTHONPATH="ai_agent"; pytest -p pytest_asyncio.plugin ai_agent/tests/ -v
```

---

## Security & Privacy Notice

CrowdVision does not transmit raw video frames, facial imagery, or personal biometric identities to third-party LLMs. Only structured numerical telemetry (occupancy counts, density indices, and velocity vectors) is evaluated by the intelligence layer.
