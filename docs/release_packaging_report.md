# EcoWatt Grid Guard — Release Packaging & Verification Report

**Release Artifact:** `EcoWatt-Grid-Guard.zip`  
**Target Location:** `C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\EcoWatt-Grid-Guard.zip`  
**Package Version:** 1.0.0-release  
**Build & Verification Date:** November 12, 2026  
**Archive Checksum (SHA-256):** `6bbbe4ef00b9eec5597a57db8bc51472f1add32f4eceec94e3e23b3be4b72b54`  
**Archive Size:** **206.08 KB** (211,027 bytes compressed / 740,557 bytes uncompressed)  
**Total Contained Files:** **121 files** across 10 top-level components  
**Top-Level Archive Prefix:** `EcoWatt-Grid-Guard/`  

---

## 1. Executive Packaging Summary

As Senior Software Build Engineer and Release Manager, the complete **EcoWatt Grid Guard** repository has been audited, validated against physical and mathematical requirements, and packaged into a clean, reproducible ZIP archive.

### Key Packaging Guarantees
* **Top-Level Root Container:** The archive unzips into a single root directory `EcoWatt-Grid-Guard/`.
* **Zero Contamination:** All development build artifacts (`node_modules/`, `dist/`, `.pytest_cache/`, `__pycache__/`, `.git/`, `.vscode/`, `.DS_Store`) are completely excluded.
* **Zero Secret Leakage:** No local `.env` files with credentials are included; only `.env.example` with documented placeholders is present.
* **100% Test Verified:** The test suite passes 23 of 23 automated tests (unit, integration, and scenario acceptance).
* **Production Build Verified:** React frontend builds cleanly via Vite in 748ms with zero TypeScript errors.
* **Embedded MQTT Broker Integration:** The archive contains the built-in asyncio MQTT 3.1.1 broker, ensuring full local operation without external Mosquitto or Docker dependencies.

---

## 2. Pre-Packaging Verification Matrix

| Verification Item | Requirement | Actual Verified Result | Status |
| :--- | :--- | :--- | :---: |
| **Python Test Suite** | 23 Pytest unit, integration, and scenario tests | **23 Passed (100% in 2.41s)** | **PASSED** |
| **Frontend Production Build** | Clean TypeScript compile + Vite bundling | **Built in 748ms (0 TS errors)** | **PASSED** |
| **Backend Startup** | FastAPI, CoAP UDP 5683, MQTT 1883 | **Initialized & listening on 8000** | **PASSED** |
| **Frontend Connectivity** | REST API & WebSocket proxy to backend | **HTTP 200 & WebSocket OPEN** | **PASSED** |
| **CoAP Telemetry Flow** | UDP 5683 telemetry from 5 zones | **`aiocoap` 2.04 Changed ACKs** | **PASSED** |
| **MQTT Broker Status** | Active pub/sub messaging | **Embedded Broker active on 1883** | **PASSED** |
| **Demonstration Scenario** | Base 8.60 kW, Target $\le 6.80$ kW | **Optimized Peak: 6.62 kW** | **PASSED** |
| **Critical Load Safety** | Zero critical load curtailment | **0 interruptions across 10 scenarios** | **PASSED** |
| **Actuator Ack & Fallback** | 3000ms timeout handling and remeasurement | **Verified in `failed_actuator_ack`** | **PASSED** |
| **All 10 Scenarios** | Included and persisted to CSV datasets | **10 CSVs in `data/generated/`** | **PASSED** |

---

## 3. Archive Component Breakdown

```
EcoWatt-Grid-Guard.zip
└── EcoWatt-Grid-Guard/
    ├── (root)         (6 files  |  19.9 KB uncompressed)
    ├── backend/       (40 files | 139.1 KB uncompressed)
    ├── config/        (2 files  |   1.6 KB uncompressed)
    ├── data/          (11 files | 224.0 KB uncompressed)
    ├── docs/          (7 files  |  43.5 KB uncompressed)
    ├── evidence/      (5 files  |  28.6 KB uncompressed)
    ├── frontend/      (31 files | 237.5 KB uncompressed)
    ├── nodered/       (2 files  |  10.4 KB uncompressed)
    ├── scripts/       (8 files  |   1.9 KB uncompressed)
    └── tests/         (9 files  |  16.6 KB uncompressed)
```

### Detailed Component Manifest
1. **Root Files (6 files):**
   * `README.md`: Comprehensive 350-line documentation covering architecture, setup, testing, and operations.
   * `.env.example`: Template configuration with placeholder environment variables.
   * `.gitignore`: Production Git exclusion rules for Python, Node, and IDE artifacts.
   * `docker-compose.yml`: Multi-container configuration for backend, frontend, and Mosquitto.
   * `package.json`: Top-level npm script proxy (`dev`, `build`, `nodered`).
   * `requirements.txt`: Locked Python dependency manifest.

2. **Backend (`backend/` — 40 files):**
   * `app/main.py`: Main FastAPI application, WebSocket streaming, and background IoT simulation loop.
   * `app/core/config.py`: Pydantic BaseSettings, ToU tariffs (INR ₹), grid carbon baseline.
   * `app/gateway/`: CoAP UDP server (`coap_server.py`) and edge telemetry aggregator (`aggregator.py`).
   * `app/sensors/`: Virtual sensor manager (`virtual_sensor.py`) and CoAP client (`coap_client.py`).
   * `app/communication/`: RFC-compliant asyncio MQTT 3.1.1 broker (`embedded_broker.py`) and Paho client (`mqtt_client.py`).
   * `app/optimizer/`: LPS scoring engine (`lps.py`), closed-loop optimizer (`engine.py`), and deferrable scheduler (`scheduler.py`).
   * `app/actuators/`: Virtual actuators with critical load locks (`virtual_actuator.py`) and hysteresis progressive restoration (`restoration.py`).
   * `app/analytics/`: Sustainability metrics calculator (`sustainability.py`).
   * `app/api/`: REST routing (`router.py`).
   * `app/database/`: SQLite session (`session.py`) and SQLAlchemy ORM models (`entities.py`).
   * `app/schemas/`: Pydantic schemas for telemetry, control, and analytics.
   * `app/simulation/`: 24-hour simulation engine (`engine.py`), 10 scenario definitions (`scenarios.py`), and profile generators (`profiles.py`).

3. **Frontend (`frontend/` — 31 files):**
   * `src/App.tsx`: Main dashboard state and page router.
   * `src/pages/`: All 7 dashboard views:
     * `OverviewDashboard.tsx`: Live building gauge, excess alert badge, cost in INR, real-time chart.
     * `BuildingZones.tsx`: 5 Zone telemetry cards with live occupancy and power metrics.
     * `LoadManagement.tsx`: 19 electrical loads with critical load protection locks.
     * `OptimizationCentre.tsx`: Live threshold/reserve margin controls and LPS weight sliders.
     * `LoadScheduler.tsx`: Deferrable EV/water heater scheduler with ToU and carbon curves.
     * `SustainabilityAnalytics.tsx`: Multi-scenario selector, KPI comparison, and CSV download.
     * `IoTCommunicationMonitor.tsx`: CoAP UDP and MQTT broker status and packet viewer.
   * `src/components/`, `src/hooks/`, `src/services/`, `src/types/`: Full component infrastructure.
   * `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`.

4. **Node-RED (`nodered/` — 2 files):**
   * `flows.json`: Visual flow editor pipeline connecting to MQTT on 1883 for threshold alerting and latency tracking.
   * `README.md`: Headless and GUI startup instructions.

5. **Tests (`tests/` — 9 files):**
   * Unit tests: LPS calculation, virtual actuators, load scheduler, sustainability formulas.
   * Integration tests: CoAP UDP telemetry flow, MQTT pub/sub pipeline, REST API endpoints.
   * System tests: Peak-demand demonstration scenario and 10-scenario invariants.

6. **Data & Datasets (`data/` — 11 files):**
   * `ecowatt.db`: Seeded SQLite database.
   * `generated/*.csv`: All 10 pre-simulated scenario datasets (96 intervals each).

7. **Evidence & Verification (`evidence/` — 5 files):**
   * `pytest_results.txt`: Raw console output of the 23 passing tests.
   * `scenarios_summary.csv`: Machine-readable summary of all 10 scenario metrics.
   * `frontend_build_log.txt`: Vite production bundling log.
   * `verification_report.md`: Complete independent verification report.
   * `communication_evidence.txt`: Live CoAP and MQTT network traces.

8. **Configuration & Reference (`config/` — 2 files):**
   * `default_config.json`: Canonical parameters for the 5-zone educational building.
   * `README.md`: Configuration guide.

9. **Scripts (`scripts/` — 8 files):**
   * Windows batch (`.bat`) and PowerShell (`.ps1`) one-click scripts for tests, backend, frontend, and full system launch.

---

## 4. Integrity Check Log

```
Archive Path: C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\EcoWatt-Grid-Guard.zip
File Count: 121
Uncompressed Size: 740,557 bytes
Compressed Size: 211,027 bytes
Compression Ratio: 28.5%
CRC Test: PASSED (zipfile.testzip() returned None)
Top-Level Check: All 121 files strictly begin with 'EcoWatt-Grid-Guard/'
Exclusion Audit:
  - node_modules: 0 matches (CLEAN)
  - .git internals: 0 matches (CLEAN)
  - .venv / venv: 0 matches (CLEAN)
  - __pycache__: 0 matches (CLEAN)
  - dist / build: 0 matches (CLEAN)
  - Real .env secrets: 0 matches (CLEAN)
```

---

## 5. Quick Extraction & Reproduction Guide

### Unpack
Extract the archive using Windows Explorer or PowerShell:
```powershell
Expand-Archive -Path "C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\EcoWatt-Grid-Guard.zip" -DestinationPath "C:\Users\kusha\Desktop\5th Sem\IOT and Sustain"
cd "C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\EcoWatt-Grid-Guard"
```

### Run Tests
```powershell
py -3.12 -m pytest tests -v
```

### Start Backend Services
```powershell
py -3.12 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### Start Frontend Dashboard
```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
*Access UI at:* `http://127.0.0.1:5173/`

