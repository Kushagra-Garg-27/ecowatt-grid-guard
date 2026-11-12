# EcoWatt Grid Guard — User Guide & Dashboard Manual

## 1. Navigating the Web Dashboard

The web dashboard is organized into 7 functional views:

1. **Overview Dashboard**:
   - High-level KPIs: Active power, demand limit, target demand, estimated daily costs, and avoided CO2.
   - Interactive 24-hour demand curve comparing baseline vs optimized operation.
   - Five-zone status preview with live sensor health tags.

2. **Building Zones**:
   - Detailed inspection for all 5 zones: *Classroom 101*, *Computer Laboratory*, *Faculty Office*, *Main Corridor*, and *Central Server Room*.
   - Displays occupancy bar (current headcount vs capacity), ambient temperature, voltage/current, and connected loads.

3. **Load Management**:
   - Inventory of all 19 electrical loads categorized into Critical, Flexible, and Deferrable.
   - Real-time Load Priority Score (LPS) calculation for each flexible candidate.
   - Manual demonstration controls: test modulating HVAC compressors to 50% or switching off auxiliary sockets.
   - *Security Feature*: Critical loads (server racks, emergency lighting, fire safety) are locked ON and protected from manual curtailment.

4. **Optimization Centre**:
   - Stage A threshold monitoring: Displays required reduction ($P_{req} = \max(0, P_{total} - P_{target})$).
   - Stage B priority queue: Loads ranked in descending order of LPS.
   - Interactive parameter sliders: Adjust $P_{threshold}$ (kW), $P_{margin}$ (kW), and the four LPS multi-criteria weights ($w_s, w_o, w_p, w_t$).
   - On-demand closed-loop optimization trigger.

5. **Load Scheduler**:
   - Visualizes deadline-constrained scheduling for Level 2 EV charging, sanitary water heating, and emergency battery storage.
   - Beta tradeoff slider: Adjust weighting between electricity cost minimization ($\beta$) and carbon footprint minimization ($1 - \beta$).
   - Displays Time-of-Use tariff profile and time-varying carbon intensity curves.

6. **Sustainability & Analytics**:
   - Comprehensive comparative charts and sustainability metrics.
   - Side-by-side comparison of baseline peak vs optimized peak, net energy saved, cost savings, and avoided emissions.
   - One-click CSV export: Download granular 96-interval simulation records for academic reporting.

7. **IoT Communication Monitor**:
   - Protocol analyzer showing live CoAP over UDP packets (`/telemetry/{power,occupancy,environment,status}`).
   - Mosquitto MQTT message inspector across topics (`ecowatt/building/demand`, `ecowatt/load/+/command`, `ecowatt/load/+/ack`).
   - Virtual sensor node heartbeat and latency tracking.

---

## 2. Operating the Simulation

- **Switching Scenarios**: Use the scenario dropdown in the top navigation bar to select any of the 10 scenarios (e.g. *Peak-Demand Event*, *High Tariff Surge*, *Low Occupancy*, or *Failed Actuator Ack*).
- **Resetting System**: Click the reset icon in the navbar to restore all actuators to 100% nominal baseline operation.
