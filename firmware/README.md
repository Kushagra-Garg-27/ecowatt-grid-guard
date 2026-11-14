# EcoWatt Grid Guard — Physical ESP32 Hardware Firmware (Reference Prototype)

> [!CAUTION]
> **ELECTRICAL SAFETY & PROTOTYPE STATUS NOTICE**:
> 1. **Reference Prototype Implementation**: The firmware in this directory is an engineering prototype design intended for reference and software-in-the-loop (SIL) evaluation. It has **NOT** undergone physical high-voltage bench qualification or long-term thermal qualification in a laboratory testbed.
> 2. **Mains Voltage Hazard**: Physical installation involves switching lethal alternating current ($230\text{ VAC } / 50\text{ Hz}$). Bench testing on live mains lines must be conducted exclusively by qualified personnel utilizing galvanically isolated test equipment, optocoupled switching stages, residual-current circuit breakers (ELCB/RCCB), and appropriate fire-rated enclosures.
> 3. **Hardware Boundary**: Verification in this repository was executed in a **Software-in-the-Loop (SIL)** simulation environment over local network interfaces. Physical silicon field testing on hardware breadboards or industrial panels has **NOT** been performed.

---

## 1. Supported Hardware & Library Versions

| Component | Target Specification | Tested / Required Library & Version |
|---|---|---|
| **MCU Board** | ESP32-WROOM-32D / ESP32-DevKitC v4 | Espressif ESP32 Arduino Core v2.0.14+ |
| **AC Power Transducer** | PZEM-004T v3.0 (100A Current Transformer) | `PZEM004Tv30` (Mandar Tare / Jakub Mandula) v1.1.2 |
| **Environmental Sensor** | DHT22 / AM2302 (Temperature & Humidity) | `DHT sensor library` (Adafruit) v1.4.6 + `Adafruit Unified Sensor` v1.1.14 |
| **JSON Serialization** | `ArduinoJson` (Benoit Blanchon) | v6.21.3 (or compatible v6.x) |
| **MQTT Client** | `PubSubClient` (Nick O'Leary) | v2.8.0 |
| **CoAP Protocol** | `WiFiUdp` / RFC 7252 compliant bit-level packager | Native ESP32 UDP |
| **Time Sync** | `lwIP` SNTP Client | Built-in ESP32 `time.h` |

---

## 2. Sensor Node Pinout & Acquisition Architecture (`esp32_sensor_node.ino`)

The sensor node interfaces with physical transducers across the documented pin assignments:

| Peripheral | Parameter Measured | ESP32 Pin | Interface Type | Acquisition & Health Handling |
|---|---|---|---|---|
| **PZEM-004T v3.0** | AC Volts ($V$), Amps ($A$), Active Power ($kW$), Power Factor ($PF$) | **GPIO16 (RX2)**, **GPIO17 (TX2)** | TTL UART2 (9600 baud, optoisolated) | **Direct Sensor Acquisition**: If communication fails or readings return `isnan()`, the node reports `sensor_health: "FAULTED"`, flags `is_measured_power: false`, and logs error details. No fabricated values are emitted. |
| **DHT22 / AM2302** | Temperature ($^\circ\text{C}$), Relative Humidity ($\%$) | **GPIO4** | 1-Wire Digital (4.7k$\Omega$ pullup) | **Direct Sensor Acquisition**: Validated against physical bounds (-40°C to 80°C, 0-100% RH). Disconnection flags `sensor_health: "FAULTED"` with `is_sensor_available: false`. |
| **HC-SR501 PIR** | Motion Presence Detection | **GPIO19** | Digital GPIO (Active-High 3.3V) | **Binary Motion Detection**: Reports `motion_detected: true/false`. Note: PIR is a pyroelectric motion presence detector and does **not** provide headcount. Headcount is explicitly flagged as unmeasured (`is_headcount_measured: false`). Multi-occupant optical counting remains a pending hardware integration. |
| **LDR Photoresistor** | Ambient Illuminance (Lux) | **GPIO34 (ADC1_CH6)** | Voltage Divider ($10\text{k}\Omega$) | **ADC Acquisition**: Reads raw 12-bit ADC (0-4095) and estimates relative illuminance. |
| **Status LED** | Wi-Fi / CoAP Transmission Indicator | **GPIO2** | Onboard Blue LED | Output Indicator |

---

## 3. Actuator Node Pinout & Safety Architecture (`esp32_actuator_node.ino`)

The actuator node performs load switching and continuous modulation:

| Peripheral | Controlled Load Type | ESP32 Pin | Electrical Mechanism | Measurement Nature |
|---|---|---|---|---|
| **Relay Channel 1** | Binary AC Load (Water Heater / Socket) | **GPIO25** | Optoisolated Relay Module (Active-Low) | **Switching Control** |
| **Relay Channel 2** | Secondary Auxiliary Binary Load | **GPIO26** | Optoisolated Relay Module (Active-Low) | **Switching Control** |
| **PWM Dimmer** | Continuous Modulation (HVAC / Lighting) | **GPIO18** | LEDC Channel 0 ($1\text{ kHz}$, 8-bit duty) | **Modulation Control** |
| **Hardware Safety Jumper** | Critical-Load Protection Interlock | **GPIO23** | Internal Pullup; Jumper to GND | **Hardware Interlock** |
| **Status LED** | MQTT Connectivity Indicator | **GPIO2** | Onboard Blue LED | Output Indicator |

### Direct Measurement vs. Estimated Calculation:
- **Sensor Node Telemetry**: Emits `"is_measured_power": true` only when the PZEM-004T current transformer returns physically valid readings.
- **Actuator Node Acknowledgement**: Emits `"is_measured_power": false` and `"estimated_power_kw"`. Power draw is estimated from nameplate capacity ($P_{\text{rated}} \times \text{operating\_level}$).

---

## 4. Hardware Safety & ACK Buffer Architecture

1. **Relay Startup Failsafe (Active-Low Inversion)**:
   - Optoisolated relay modules are typically Active-Low.
   - Driving `pinMode(OUTPUT)` prior to setting the output register causes a momentary LOW glitch that briefly energizes the load during microcontroller boot.
   - **Failsafe in Firmware**: The sketch drives `digitalWrite(RELAY_CH1_PIN, HIGH)` **before** calling `pinMode(RELAY_CH1_PIN, OUTPUT)`, ensuring contacts boot strictly open/de-energized.
2. **Compressor Modulation Floor**:
   - Inverter heat pump compressors stall if throttled below mechanical displacement limits. The firmware clamps modulation to $\ge 0.45$.
3. **Physical Critical-Load Interlock (GPIO23)**:
   - Connecting GPIO23 to GND enforces an unconditional hardware interlock that rejects all curtailment commands (`REJECTED_CRITICAL_PROTECTED`).
4. **Volatile SRAM ACK Buffer & Overflow Policy**:
   - Offline execution acknowledgements are held in a 16-slot FIFO ring buffer (`MAX_PENDING_ACKS = 16`).
   - **Volatile Limitation**: This buffer resides in volatile SRAM and does **NOT** survive power interruptions, reboots, or brownouts. Durable delivery requires non-volatile storage (NVS/Flash), which remains a pending hardware qualification.
   - **Overflow Policy (Oldest-Drop)**: When the buffer fills to 16/16 during an extended broker disconnection, the oldest unacknowledged item is evicted, `droppedAckCount` is incremented, and an explicit diagnostic warning is printed to Serial (`[ACK BUFFER OVERFLOW]`).
   - **Retransmission**: Upon reconnection, queued ACKs are drained in FIFO order with `"retransmitted": true` and `"buffer_dropped_total": droppedAckCount`.

---

## 5. Toolchain & Compilation Instructions

### Reproducible Compilation with `arduino-cli`:
To compile the sketches from the command line:

```bash
# 1. Initialize configuration and update package indexes
arduino-cli config init
arduino-cli core update-index

# 2. Install the ESP32 core
arduino-cli core install esp32:esp32

# 3. Install required libraries
arduino-cli lib install "PZEM004Tv30"
arduino-cli lib install "DHT sensor library"
arduino-cli lib install "Adafruit Unified Sensor"
arduino-cli lib install "ArduinoJson"
arduino-cli lib install "PubSubClient"

# 4. Compile Sensor Node sketch
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_sensor_node

# 5. Compile Actuator Node sketch
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_actuator_node
```

### Host Compilation Audit:
- During this audit pass, `arduino-cli` was verified as **not installed on the host environment PATH**. Consequently, local compilation was not executed on this machine.
- Follow the instructions above to compile in an environment with the Arduino CLI or Arduino IDE 2.x installed.
- **Physical testing status**: Physical testing on live silicon microcontrollers has **not** been performed.
