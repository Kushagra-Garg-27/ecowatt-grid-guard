# EcoWatt Grid Guard — Physical ESP32 Hardware Firmware (Reference Prototype)

> [!CAUTION]
> **ELECTRICAL SAFETY & PROTOTYPE STATUS NOTICE**:
> 1. **Reference Prototype Implementation**: The firmware in this directory is an engineering prototype design intended for reference and software-in-the-loop (SIL) evaluation. It has **NOT** undergone physical high-voltage bench qualification or long-term thermal qualification in a laboratory testbed.
> 2. **Mains Voltage Hazard**: Physical installation involves switching lethal alternating current ($230\text{ VAC } / 50\text{ Hz}$). Bench testing on live mains lines must be conducted exclusively by qualified personnel utilizing galvanically isolated test equipment, optocoupled switching stages, residual-current circuit breakers (ELCB/RCCB), and appropriate fire-rated enclosures.
> 3. **Hardware Boundary**: Previous validation in this repository was executed in a **Software-in-the-Loop (SIL)** simulation environment over local network interfaces. Do not assume physical silicon field testing has been performed.

---

## 1. Supported Hardware & Library Versions

| Component | Target Specification | Tested / Required Version |
|---|---|---|
| **MCU Board** | ESP32-WROOM-32D / ESP32-DevKitC v4 | Espressif ESP32 Arduino Core v2.0.14+ |
| **JSON Parser** | `ArduinoJson` | v6.21.3 (or compatible v6.x) |
| **MQTT Client** | `PubSubClient` (Nick O'Leary) | v2.8.0 |
| **CoAP Protocol** | `WiFiUdp` / RFC 7252 compliant bit-level packager | Native ESP32 UDP |
| **Time Sync** | `lwIP` SNTP Client | Built-in ESP32 `time.h` |

---

## 2. Sensor Node Pinout & Transducer Types (`esp32_sensor_node.ino`)

The sensor node interfaces with physical transducers. All parameters are **direct physical measurements**:

| Peripheral | Parameter Measured | ESP32 Pin | Interface Type | Measurement Nature |
|---|---|---|---|---|
| **PZEM-004T v3.0** | AC Volts ($V$), Amps ($A$), Active Power ($kW$), Power Factor ($PF$) | **GPIO16 (RX2)**, **GPIO17 (TX2)** | TTL UART (9600 baud, optoisolated) | **Direct Sensor Reading** (Split-core Current Transformer + Voltage tap) |
| **DHT22 / AM2302** | Temperature ($^\circ\text{C}$), Relative Humidity ($\%$) | **GPIO4** | 1-Wire Digital (4.7k$\Omega$ pullup) | **Direct Sensor Reading** |
| **HC-SR501 PIR** | Zone Occupancy & Motion Detection | **GPIO19** | Digital GPIO (Active-High 3.3V) | **Direct Sensor Reading** |
| **LDR Photoresistor** | Ambient Illuminance (Lux) | **GPIO34 (ADC1_CH6)** | Voltage Divider ($10\text{k}\Omega$) | **Direct Sensor Reading** |
| **Status LED** | Wi-Fi / CoAP Transmission Indicator | **GPIO2** | Onboard Blue LED | Output Indicator |

---

## 3. Actuator Node Pinout & Safety Architecture (`esp32_actuator_node.ino`)

The actuator node performs load switching and continuous modulation. **Power values reported by the actuator node are estimated calculations, not direct meter readings**:

| Peripheral | Controlled Load Type | ESP32 Pin | Electrical Mechanism | Measurement Nature |
|---|---|---|---|---|
| **Relay Channel 1** | Binary AC Load (Water Heater / Socket) | **GPIO25** | Optoisolated Relay Module (Active-Low) | **Switching Control** |
| **Relay Channel 2** | Secondary Auxiliary Binary Load | **GPIO26** | Optoisolated Relay Module (Active-Low) | **Switching Control** |
| **PWM Dimmer** | Continuous Modulation (HVAC / Lighting) | **GPIO18** | LEDC Channel 0 ($1\text{ kHz}$, 8-bit duty) | **Modulation Control** |
| **Hardware Safety Jumper** | Critical-Load Protection Interlock | **GPIO23** | Internal Pullup; Jumper to GND | **Hardware Interlock** |
| **Status LED** | MQTT Connectivity Indicator | **GPIO2** | Onboard Blue LED | Output Indicator |

### Direct Measurement vs. Estimated Calculation:
- **Sensor Node Telemetry**: Contains `"is_measured_power": true`. Readings ($kW, V, A, PF$) originate directly from the physical current transformer and voltage divider on the PZEM-004T board.
- **Actuator Node Acknowledgement**: Contains `"is_measured_power": false` and `"estimated_power_kw"`. Power draw is calculated via $P_{\text{est}} = P_{\text{rated}} \times \text{operating\_level}$. If a dedicated CT is not co-located with the actuator, the edge gateway uses telemetry from the edge aggregator for closed-loop confirmation.

---

## 4. Hardware Safety & Failsafe Design

1. **Relay Startup Failsafe**:
   - Optoisolated relay modules are typically **Active-Low** (input pulled LOW energizes the coil).
   - If `pinMode(pin, OUTPUT)` is invoked before the pin output register is initialized, the pin floats LOW momentarily, causing a power surge.
   - **Remedy in Code**: The firmware drives `digitalWrite(RELAY_CH1_PIN, HIGH)` **before** calling `pinMode(RELAY_CH1_PIN, OUTPUT)`. The relays boot strictly de-energized (Normally Open contact open).
2. **Compressor Anti-Short-Cycling & Modulation Floor**:
   - Variable-refrigerant or inverter HVAC compressors stall or overheat if commanded below their mechanical displacement limits.
   - The firmware enforces a hard physical clamp: $\text{targetLevel} = \max(0.45, \min(1.0, \text{requestedLevel}))$.
3. **Physical Critical-Load Interlock (GPIO23)**:
   - For life-safety and server infrastructure, software safety must be backed by a physical hardware interlock.
   - GPIO23 is configured with an internal pull-up. When a physical jumper connects GPIO23 to GND, the firmware rejects all `CURTAIL` or modulation reduction commands at the interrupt/callback level (`REJECTED_CRITICAL_PROTECTED`), refusing to actuate the relays regardless of what MQTT payload is received.
4. **Acknowledgement Publication Buffering**:
   - If an MQTT disconnect occurs immediately following an actuation event, the generated execution acknowledgement is preserved in a circular RAM buffer (`pendingAckBuffer`).
   - Upon MQTT socket reconnect, all unacknowledged events are immediately flushed to the broker with `"retransmitted": true`, ensuring the edge gateway never experiences lost state confirmations.

---

## 5. Credential Configuration Guide

1. In the `firmware/esp32_sensor_node/` and `firmware/esp32_actuator_node/` directories, copy the template:
   ```bash
   cp secrets.example.h secrets.h
   ```
2. Open `secrets.h` and configure your credentials:
   ```cpp
   #define ECOWATT_WIFI_SSID     "Your_Isolated_IoT_SSID"
   #define ECOWATT_WIFI_PASSWORD "Your_WPA2_Secret_Key"
   #define ECOWATT_GATEWAY_HOST  "192.168.1.100" // Edge Gateway IP
   #define ECOWATT_COAP_PORT     5683
   #define ECOWATT_MQTT_HOST     "192.168.1.100" // MQTT Broker IP
   #define ECOWATT_MQTT_PORT     1883
   ```
3. Compile and upload via the Arduino IDE or PlatformIO.
   - If `secrets.h` is missing, compilation will abort with `#error "Missing secrets.h!"`.
   - If placeholder values are left unchanged, startup will abort with a fatal serial message and rapid LED flashing.
