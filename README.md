# CrowdVision: Predictive Crowd Intelligence & Agentic Monitoring

CrowdVision is an intelligent crowd monitoring, computer vision, and predictive spatial safety platform. It integrates high-throughput CV analytics (YOLO person detection, ByteTrack multi-object tracking, and perspective-calibrated zone mapping) with an interactive AI Copilot and an independent analytical AI Agent to forecast overcrowding risks and execute confirmed operator mitigation actions.

---

## Key System Capabilities

- **Task & Spatial Management**: Dedicated monitoring tasks with persistent polygon zone definitions, configurable design capacities, and camera perspective calibration.
- **Computer Vision Pipeline**: Real-time person detection, ground-contact point mapping, velocity tracking, and density estimation with automated fallback to OpenCV HOG/motion compensation.
- **Predictive Heatmaps**: Real-time spatial Gaussian density heatmaps with multi-horizon forward projections (+30s, +60s, +180s, +300s).
- **Synchronized Tri-Pane Monitoring**: Real-time synchronized inspection of raw video feed, computer-vision crowd density heatmap, and spatial zone risk hierarchy.
- **Interactive AI Copilot**: Grounded operational Copilot supporting natural language queries over real telemetry, backed by Google Gemini with deterministic offline fallback and human-in-the-loop confirmed action execution.
- **Independent AI Agent**: Dedicated microservice for multi-horizon risk scoring, hysteresis-based alert lifecycle management, and automated action suggestions.
- **Interactive Web Console**: High-density React 19, TypeScript, Tailwind CSS, & Vite operator workstation with live WebSocket telemetry, zone drawing tools, and alert resolution workflows.

---

## Repository Layout

```
.
├── backend/            # FastAPI analytics server, CV pipeline, AI Copilot & SQLite/PostgreSQL storage
│   ├── app/
│   │   ├── analytics/  # Zone mapping, density calculation, heatmap generation & prediction
│   │   ├── api/        # REST and WebSocket endpoints (tasks, layouts, videos, alerts, copilot, health)
│   │   ├── copilot/    # Modular LLM providers, tool schemas, confirmed action executor & service
│   │   ├── cv/         # Video source decoding, YOLO/HOG detection, ByteTrack & perspective estimation
│   │   ├── database/   # SQLAlchemy models, async sessions, and database migrations
│   │   └── services/   # Background video processor, alert manager & client integrations
│   └── tests/          # 53 automated unit, integration, and security tests
├── ai_agent/           # Independent crowd management AI agent & risk interpreter microservice
│   └── tests/          # 33 automated unit, integration, performance, and resilience tests
├── frontend/           # React 19, TypeScript, Tailwind CSS, Lucide icons & Vite operator UI
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

Install root dependencies (Python 3.11+ recommended):
```bash
pip install -r requirements.txt
```

### 2. Run the Backend Service
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation is available at `http://localhost:8000/docs`.

### 3. Run the AI Agent Service (Optional microservice)
```bash
cd ai_agent
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
Agent Documentation is available at `http://localhost:8001/docs`.

### 4. Run the Operator Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Automated Verification & Testing

Both subsystems include comprehensive automated unit, integration, security, and end-to-end workflow test suites (86 passing tests total):

```bash
# Run all backend tests (including ElevenLabs voice announcement test suite)
python -m pytest -o pythonpath=backend backend/tests/ -v

# Run backend ElevenLabs voice tests specifically (24 passing unit tests)
python -m pytest -o pythonpath=backend backend/tests/unit/test_elevenlabs_voice_announcements.py -v

# Run AI agent tests (33 passing tests)
python -m pytest -o pythonpath=ai_agent ai_agent/tests/ -v

# Run frontend audio authority, batching, and queue tests (30 passing tests)
node frontend/tests/singleVoiceAuthority.test.js
node frontend/tests/alertBatchManager.test.js
node frontend/tests/voiceAnnouncement.test.js

# Verify frontend production build
npm --prefix frontend run build
```

---

## ElevenLabs Voice Announcements Integration

CrowdVision includes a production-grade operational voice announcement system powered by the ElevenLabs Text-to-Speech API.

### Core Architecture & Capabilities
1. **17-Second Alert Aggregation Window**: Upon arrival of the first eligible alert, a fixed 17-second collection window opens. Incoming alerts are grouped by stable zone ID.
2. **Latest-Alert-Per-Zone Selection**: Within the 17-second window, older alerts for the same zone are replaced with the latest update. When the window expires, only the latest alert per zone is announced, preserving the order in which zones first appeared.
3. **Critical Escalation Policy**: Critical alerts trigger prompt batch finalization without waiting for the full 17-second timer, while respecting currently playing audio without overlap.
4. **Absolute Single Voice Authority**: Announcements play strictly sequentially (`MAX_CONCURRENT_ACTIVE_PLAYBACKS === 1`). Two voices can NEVER speak simultaneously.
5. **Cross-Tab & Browser Scope**: Enforces single playback ownership across browser tabs using the Web Locks API (`navigator.locks.request('crowdvision_single_voice_authority')`) and `BroadcastChannel`. Only the elected authority tab plays audio.
6. **Bilingual Support (English & Hindi)**:
   - English: `"Attention. High crowd density detected at Main Stage. Current occupancy is 82 percent."`
   - Hindi: `"सावधान। मेन स्टेज पर भीड़ का घनत्व अधिक है। वर्तमान ऑक्यूपेंसी 82 प्रतिशत है।"`
7. **Failure Isolation**: TTS or audio errors never block the alert engine, database persistence, dashboard updates, or subsequent audio queue items.

### Configuration
Configure the following in `backend/.env`:
```ini
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=tnSpp4vdxKPjI9w0GnoV
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
ELEVENLABS_ENABLED=true
ELEVENLABS_LANGUAGE=en  # Set to "en" for English, "hi" for Hindi
ELEVENLABS_AGENT_ID=agent_5901m7wxc43gfgrsnrqhw6wdjcqt
```

---

## Security & Privacy Notice

CrowdVision does not transmit raw video frames, facial imagery, or personal biometric identities to third-party LLMs. Only structured numerical telemetry (occupancy counts, density indices, and velocity vectors) is evaluated by the intelligence layer. All administrative actions (such as capacity modifications or pipeline shutdowns) enforce strict human-in-the-loop operator confirmation.
