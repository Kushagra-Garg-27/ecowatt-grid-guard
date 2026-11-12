# EcoWatt Grid Guard — Installation & Setup Guide

This guide details how to install, configure, and execute the complete **EcoWatt Grid Guard** system on **Windows**, **Linux/macOS**, and via **Docker Compose**.

---

## 1. System Requirements

- **Python**: Python 3.11, 3.12, or newer.
- **Node.js**: Node.js v18.0.0 or newer with `npm` v9+.
- **Operating System**: Windows 10/11, Ubuntu 22.04+, or macOS Sonoma+.
- **Ports Required**:
  - `8000`: FastAPI Backend & WebSocket
  - `5173`: React Frontend Dashboard
  - `5683/udp`: CoAP UDP Server
  - `1883`: MQTT Broker (Mosquitto or Embedded Asyncio Broker)
  - `1880`: Node-RED (optional)

---

## 2. Windows Local Installation (Native Execution)

### Step 1: Clone the Repository
```powershell
git clone <repo_url>
cd "EcoWatt-Grid-Guard"
```

### Step 2: Set Up Python Dependencies
Install required packages into your Python 3.12 environment:
```powershell
py -3.12 -m pip install -r backend/requirements.txt
```

### Step 3: Install Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

### Step 4: Verify Database & Generate Baseline Datasets
Execute the benchmark simulation to initialize the SQLite database and pre-generate the scenario CSVs:
```powershell
py -3.12 -c "from backend.app.simulation.engine import simulation_engine; simulation_engine.run_scenario('peak_demand_event')"
```

---

## 3. Launching the System

### Option A: One-Click Startup (Recommended for Windows)
Double-click or run:
```powershell
.\scripts\start_all.ps1
```
or from standard Command Prompt:
```cmd
scripts\start_all.bat
```
This automatically launches both backend services and the Vite frontend in dedicated terminal sessions.

### Option B: Manual Two-Terminal Startup

**Terminal 1 — Backend & IoT Gateways:**
```powershell
py -3.12 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Note*: The backend automatically initializes:
- Async SQLite database at `data/ecowatt.db`
- Embedded MQTT Broker on `127.0.0.1:1883`
- CoAP UDP Server on `127.0.0.1:5683`
- Background virtual sensor emit loop

**Terminal 2 — React Dashboard:**
```powershell
cd frontend
npm run dev
```

Open your browser at:
- **React Dashboard**: `http://localhost:5173`
- **Swagger REST API**: `http://127.0.0.1:8000/docs`

---

## 4. Running via Docker Compose

If Docker Desktop is running on your machine:
```bash
docker compose up --build
```
This starts:
- Eclipse Mosquitto MQTT on `1883`
- Node-RED Visual Flows on `1880`
- Python Edge Gateway & CoAP on `8000` & `5683/udp`
- Production-built React Dashboard on `5173`

---

## 5. Running Automated Tests

Run the complete 23-test automated test suite:
```powershell
.\scripts\run_tests.ps1
```
or directly via pytest:
```powershell
py -3.12 -m pytest backend/tests -v
```

