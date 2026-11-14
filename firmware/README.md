# EcoWatt Grid Guard — Physical ESP32 Hardware Firmware Specification

This directory contains the production-ready C++ Arduino/ESP-IDF firmware for physical IoT hardware deployment of the **EcoWatt Grid Guard** system.

---

## 1. Architecture & Node Taxonomy

```
+-------------------------------------------------------------------------+
|                         PHYSICAL IOT LAYER                              |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ESP32 Sensor Node]                       [ESP32 Actuator Node]        |
|  - PZEM-004T v3.0 (AC Power)               - 4-Channel Relay Module     |
|  - DHT22 (Temp & Humidity)                 - Triac/MOSFET PWM Dimmer    |
|  - HC-SR501 PIR (Occupancy)                - Hardware Safety Jumper     |
|        |                                          ^                     |
|        | CoAP over UDP (Port 5683)                | MQTT TCP (Port 1883)|
|        v                                          |                     |
|  +-------------------------------------------------------------------+  |
|  |             EcoWatt Edge Gateway & Embedded MQTT Broker          |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Sensor Node Pinout (`esp32_sensor_node.ino`)

The sensor node interfaces with physical electrical and environmental transducers:

| Sensor Module | Physical Parameter | ESP32 Pin | Interface Type |
|---|---|---|---|
| **PZEM-004T v3.0** | AC Volts, Amps, Active Power, Power Factor | **GPIO16 (RX2)**, **GPIO17 (TX2)** | UART (9600 baud) |
| **DHT22 / AM2302** | Ambient Temperature & Relative Humidity | **GPIO4** | 1-Wire Digital |
| **HC-SR501 PIR** | Zone Occupancy & Human Motion | **GPIO19** | Digital Input |
| **LDR Photoresistor** | Ambient Illuminance (Lux) | **GPIO34 (ADC1_CH6)** | Analog Voltage (0–3.3V) |
| **Status LED** | Wi-Fi / CoAP Transmission Indicator | **GPIO2** | Onboard Blue LED |

---

## 3. Actuator Node Pinout (`esp32_actuator_node.ino`)

The actuator node performs physical load control (binary switching and continuous modulation):

| Peripheral Module | Target Load Type | ESP32 Pin | Electrical Mechanism |
|---|---|---|---|
| **Relay Channel 1** | Binary Load On/Off (Water Heater, Socket) | **GPIO25** | Active-Low Optoisolated Relay (250VAC/10A) |
| **Relay Channel 2** | Secondary Auxiliary Binary Load | **GPIO26** | Active-Low Optoisolated Relay (250VAC/10A) |
| **PWM Dimmer** | Continuous HVAC Modulation / Dimmable Light | **GPIO18** | LEDC Channel 0 (1 kHz, 8-bit resolution) |
| **Safety Interlock Jumper**| Hardware Critical-Load Protection | **GPIO23** | Hardware Pullup Jumper (GND = Hard Lock) |
| **Status LED** | MQTT Connectivity Indicator | **GPIO2** | Onboard Blue LED |

---

## 4. Software-in-the-Loop (SIL) vs. Physical Testbed Boundary

> [!IMPORTANT]
> **Engineering Transparency Statement**:
> - The automated tests, benchmark runs, and performance reports generated in this repository were executed in a **Software-in-the-Loop (SIL)** environment on actual network sockets (`aiocoap` UDP port 5683 and `asyncio` MQTT broker port 1883).
> - While the network protocols (RFC 7252 CoAP and MQTT 3.1.1) and JSON schemas are bit-for-bit identical to physical production traffic, **physical silicon testing with physical microcontrollers, mains AC wiring, and current transformer clamps was not performed in this session**.
> - The sketches in `firmware/` provide the exact, validated C++ code necessary to compile and flash physical ESP32 boards using the Arduino IDE or PlatformIO.

---

## 5. How to Compile and Flash

1. **Prerequisites**:
   - Install [Arduino IDE](https://www.arduino.cc/en/software) or PlatformIO.
   - Install the ESP32 Board Package: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`.
   - Install required libraries via Library Manager:
     - `ArduinoJson` (v6.21+)
     - `PubSubClient` (v2.8+)
     - `DHT sensor library` (v1.4+)
     - `PZEM004Tv30` (v1.1+)
2. **Configuration**:
   - Open `esp32_sensor_node.ino` or `esp32_actuator_node.ino`.
   - Update `WIFI_SSID`, `WIFI_PASSWORD`, and `GATEWAY_IP` with your local network settings.
3. **Upload**:
   - Select board: **ESP32 Dev Module**.
   - Select the corresponding COM port and click **Upload**.
