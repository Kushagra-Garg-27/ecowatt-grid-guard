/*
 * ==============================================================================
 * EcoWatt Grid Guard — Physical ESP32 Sensor Node Firmware (Reference Prototype)
 * ==============================================================================
 * Target Hardware: ESP32-WROOM-32D / ESP32-DevKitC
 * Protocol: CoAP over UDP (RFC 7252) to EcoWatt Edge Gateway
 *
 * Transducers & Interfaces:
 *   - AC Power Monitor: PZEM-004T v3.0 (UART2: GPIO16-RX2, GPIO17-TX2)
 *   - Environmental: DHT22 (GPIO4) & LDR Photoresistor (GPIO34 / ADC1_CH6)
 *   - Motion Presence: HC-SR501 PIR (GPIO19) [Binary motion detection only]
 *
 * Required Libraries:
 *   - PZEM004Tv30 by Mandar Tare / Jakub Mandula (v1.1.2)
 *   - DHT sensor library by Adafruit (v1.4.6)
 *   - Adafruit Unified Sensor by Adafruit (v1.1.14)
 *   - ArduinoJson by Benoit Blanchon (v6.21.3)
 *
 * NOTE: Reference prototype implementation pending physical field validation.
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <time.h>
#include <PZEM004Tv30.h>
#include <DHT.h>

// --- Configuration Management ---
#if __has_include("secrets.h")
    #include "secrets.h"
#elif __has_include("../secrets.h")
    #include "../secrets.h"
#else
    #error "Missing secrets.h! Copy secrets.example.h to secrets.h and enter your Wi-Fi/Gateway credentials."
#endif

// Compile-Time Configuration Sanity Checks
#ifndef ECOWATT_WIFI_SSID
    #error "ECOWATT_WIFI_SSID is not defined in secrets.h"
#endif
#ifndef ECOWATT_WIFI_PASSWORD
    #error "ECOWATT_WIFI_PASSWORD is not defined in secrets.h"
#endif
#ifndef ECOWATT_GATEWAY_HOST
    #error "ECOWATT_GATEWAY_HOST is not defined in secrets.h"
#endif
#ifndef ECOWATT_COAP_PORT
    #define ECOWATT_COAP_PORT 5683
#endif
#ifndef ECOWATT_NTP_SERVER
    #define ECOWATT_NTP_SERVER "pool.ntp.org"
#endif

// --- Node & Zone Metadata ---
const char* SENSOR_ID = "esp32_sensor_cls_01";
const char* ZONE_ID   = "classroom";

// --- Hardware Pin Definitions ---
#define PZEM_RX_PIN    16  // Connects to PZEM-004T TX
#define PZEM_TX_PIN    17  // Connects to PZEM-004T RX
#define DHT_PIN        4   // Connects to DHT22 Data pin (with 4.7k pullup)
#define DHT_TYPE       DHT22
#define PIR_PIN        19  // Connects to HC-SR501 Output
#define LDR_ADC_PIN    34  // Connects to LDR / 10k resistor junction (ADC1)
#define STATUS_LED_PIN 2

// --- Sensor Objects ---
HardwareSerial pzemSerial(2);
PZEM004Tv30 pzem(pzemSerial, PZEM_RX_PIN, PZEM_TX_PIN);
DHT dht(DHT_PIN, DHT_TYPE);

// --- Timing Configuration ---
const unsigned long TELEMETRY_INTERVAL_MS = 15000; // 15-second reporting cadence
unsigned long lastTelemetryTime = 0;
WiFiUDP udp;

void connectWiFi();
void emitAllTelemetry();
String getISOTimestamp(bool& isSynced);
bool sendCoAPPost(const char* resourcePath, const String& jsonPayload);

void setup() {
    Serial.begin(115200);
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
    pinMode(PIR_PIN, INPUT);
    pinMode(LDR_ADC_PIN, INPUT);

    Serial.println("\n=======================================================");
    Serial.println(" EcoWatt Grid Guard — ESP32 Sensor Node (Prototype)   ");
    Serial.println("=======================================================");

    // Runtime Configuration Validation
    if (strcmp(ECOWATT_WIFI_SSID, "YOUR_WIFI_SSID") == 0 || strlen(ECOWATT_WIFI_SSID) == 0) {
        Serial.println("\n[FATAL ERROR] Wi-Fi SSID is unconfigured! Edit secrets.h and reflash.");
        while (true) {
            digitalWrite(STATUS_LED_PIN, HIGH);
            delay(100);
            digitalWrite(STATUS_LED_PIN, LOW);
            delay(100);
        }
    }

    // Initialize Physical Sensor Hardware Interfaces
    Serial.println("[PZEM] Initializing UART2 on GPIO16(RX) / GPIO17(TX)...");
    pzemSerial.begin(9600, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);

    Serial.println("[DHT22] Initializing digital sensor on GPIO4...");
    dht.begin();

    connectWiFi();

    // Initialize Network Time Protocol (NTP) for UTC timestamps
    configTime(0, 0, ECOWATT_NTP_SERVER, "time.google.com");
    Serial.println("[NTP] Synchronizing UTC time...");

    udp.begin(ECOWATT_COAP_PORT);
    Serial.printf("[CoAP] UDP client listening locally, sending to %s:%d\n", ECOWATT_GATEWAY_HOST, ECOWATT_COAP_PORT);
}

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
    }

    unsigned long now = millis();
    if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = now;
        emitAllTelemetry();
    }

    delay(50);
}

void connectWiFi() {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.printf("[WiFi] Connecting to SSID: %s", ECOWATT_WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ECOWATT_WIFI_SSID, ECOWATT_WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(400);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected! IP: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
        digitalWrite(STATUS_LED_PIN, HIGH);
    } else {
        Serial.println("\n[WiFi] Connection timeout. Sensor node will retry on next cycle.");
    }
}

String getISOTimestamp(bool& isSynced) {
    time_t nowSec = time(nullptr);
    if (nowSec > 1000000000) { // Valid epoch time (> year 2001)
        isSynced = true;
        struct tm timeinfo;
        gmtime_r(&nowSec, &timeinfo);
        char buf[32];
        strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
        return String(buf);
    } else {
        isSynced = false;
        // Fallback relative timestamp based on milliseconds uptime
        unsigned long sec = millis() / 1000;
        char buf[32];
        snprintf(buf, sizeof(buf), "1970-01-01T%02lu:%02lu:%02luZ", (sec / 3600) % 24, (sec / 60) % 60, sec % 60);
        return String(buf);
    }
}

// Simple CoAP POST packet builder (Confirmable POST with Uri-Path)
bool sendCoAPPost(const char* resourcePath, const String& jsonPayload) {
    if (WiFi.status() != WL_CONNECTED) return false;

    static uint16_t messageId = 0x1000;
    messageId++;

    uint8_t packet[512];
    int idx = 0;

    // Header: Ver=1, T=CON(0), TKL=0, Code=POST (0.02)
    packet[idx++] = 0x40;
    packet[idx++] = 0x02;
    packet[idx++] = (messageId >> 8) & 0xFF;
    packet[idx++] = messageId & 0xFF;

    // Split resource path e.g. "telemetry/power"
    String pathStr = String(resourcePath);
    int slashIdx = pathStr.indexOf('/');
    String seg1 = (slashIdx >= 0) ? pathStr.substring(0, slashIdx) : pathStr;
    String seg2 = (slashIdx >= 0) ? pathStr.substring(slashIdx + 1) : "";

    // Uri-Path Option 11
    int seg1Len = seg1.length();
    packet[idx++] = (11 << 4) | (seg1Len & 0x0F);
    for (int i = 0; i < seg1Len; i++) packet[idx++] = seg1[i];

    if (seg2.length() > 0) {
        int seg2Len = seg2.length();
        packet[idx++] = (0 << 4) | (seg2Len & 0x0F);
        for (int i = 0; i < seg2Len; i++) packet[idx++] = seg2[i];
    }

    // Payload Marker (0xFF)
    packet[idx++] = 0xFF;

    int payloadLen = jsonPayload.length();
    for (int i = 0; i < payloadLen && idx < 510; i++) {
        packet[idx++] = jsonPayload[i];
    }

    udp.beginPacket(ECOWATT_GATEWAY_HOST, ECOWATT_COAP_PORT);
    udp.write(packet, idx);
    int ok = udp.endPacket();

    if (ok) {
        Serial.printf("[CoAP] Sent %d bytes to %s:%d/%s\n", idx, ECOWATT_GATEWAY_HOST, ECOWATT_COAP_PORT, resourcePath);
        return true;
    } else {
        Serial.printf("[CoAP ERROR] Failed transmitting packet to %s:%d/%s\n", ECOWATT_GATEWAY_HOST, ECOWATT_COAP_PORT, resourcePath);
        return false;
    }
}

void emitAllTelemetry() {
    bool timeSynced = false;
    String timestampStr = getISOTimestamp(timeSynced);

    // =========================================================================
    // 1. AC Power Telemetry: Direct Acquisition from PZEM-004T v3.0
    // =========================================================================
    float voltage   = pzem.voltage();
    float current   = pzem.current();
    float power_w   = pzem.power();
    float pf        = pzem.pf();

    bool pzemValid = (!isnan(voltage) && voltage >= 80.0 && voltage <= 300.0 &&
                      !isnan(current) && current >= 0.0 && current <= 100.0 &&
                      !isnan(power_w) && power_w >= 0.0 &&
                      !isnan(pf) && pf >= 0.0 && pf <= 1.0);

    StaticJsonDocument<384> pwrDoc;
    pwrDoc["sensor_id"] = SENSOR_ID;
    pwrDoc["zone_id"]   = ZONE_ID;
    pwrDoc["timestamp"] = timestampStr;

    if (pzemValid) {
        pwrDoc["is_measured_power"] = true; // Actual CT + voltage tap measurement
        pwrDoc["sensor_health"]     = timeSynced ? "HEALTHY" : "DEGRADED";
        pwrDoc["power_kw"]          = round((power_w / 1000.0) * 1000.0) / 1000.0;
        pwrDoc["voltage_v"]         = round(voltage * 10.0) / 10.0;
        pwrDoc["current_a"]         = round(current * 100.0) / 100.0;
        pwrDoc["power_factor"]      = round(pf * 100.0) / 100.0;
        pwrDoc["error_details"]     = nullptr;
    } else {
        // Sensor offline or read failure: do NOT publish fabricated measurements!
        pwrDoc["is_measured_power"] = false;
        pwrDoc["sensor_health"]     = "FAULTED";
        pwrDoc["power_kw"]          = 0.0;
        pwrDoc["voltage_v"]         = 0.0;
        pwrDoc["current_a"]         = 0.0;
        pwrDoc["power_factor"]      = 0.0;
        pwrDoc["error_details"]     = "PZEM-004T acquisition failure: sensor offline or CRC error";
        Serial.printf("[SENSOR WARN] PZEM-004T read failure! (V: %f, I: %f, P: %f)\n", voltage, current, power_w);
    }

    String pwrPayload;
    serializeJson(pwrDoc, pwrPayload);
    sendCoAPPost("telemetry/power", pwrPayload);

    // =========================================================================
    // 2. Zone Occupancy & Motion Detection: Direct Reading from HC-SR501 PIR
    // =========================================================================
    int pirRaw = digitalRead(PIR_PIN);
    bool motionDetected = (pirRaw == HIGH);

    StaticJsonDocument<384> occDoc;
    occDoc["sensor_id"]             = SENSOR_ID;
    occDoc["zone_id"]               = ZONE_ID;
    occDoc["timestamp"]             = timestampStr;
    occDoc["sensor_health"]         = "HEALTHY";
    occDoc["motion_detected"]       = motionDetected;
    occDoc["pir_raw_state"]         = pirRaw;
    // NOTE: HC-SR501 PIR provides binary infrared motion presence.
    // It does NOT provide multi-person headcount. We report binary active state (1 or 0)
    // and explicitly flag headcount as unmeasured pending optical counting hardware.
    occDoc["occupancy"]             = motionDetected ? 1 : 0;
    occDoc["max_occupancy"]         = 35;
    occDoc["is_headcount_measured"] = false;
    occDoc["occupancy_source"]      = "PIR_BINARY_PRESENCE";
    occDoc["detection_notes"]       = "Binary PIR presence state. Accurate headcount requires optical sensor integration.";

    String occPayload;
    serializeJson(occDoc, occPayload);
    sendCoAPPost("telemetry/occupancy", occPayload);

    // =========================================================================
    // 3. Environmental Telemetry: Direct Acquisition from DHT22 & LDR ADC
    // =========================================================================
    float temperature = dht.readTemperature();
    float humidity    = dht.readHumidity();
    int ldrRaw        = analogRead(LDR_ADC_PIN); // 0 - 4095 on ESP32 ADC1

    bool dhtValid = (!isnan(temperature) && temperature >= -40.0 && temperature <= 80.0 &&
                     !isnan(humidity) && humidity >= 0.0 && humidity <= 100.0);

    StaticJsonDocument<384> envDoc;
    envDoc["sensor_id"] = SENSOR_ID;
    envDoc["zone_id"]   = ZONE_ID;
    envDoc["timestamp"] = timestampStr;

    // Relative ambient light index derived from 10k LDR voltage divider (0-4095 ADC mapped to 0-1000 index).
    // NOTE: This represents an uncalibrated relative ambient illumination indicator, not a calibrated NIST lux measurement.
    float lightIndex = ((float)ldrRaw / 4095.0) * 1000.0;
    envDoc["lux_level"]             = round(lightIndex * 10.0) / 10.0; // Preserved for telemetry schema compatibility
    envDoc["relative_light_index"]  = round(lightIndex * 10.0) / 10.0;
    envDoc["ldr_raw_adc"]           = ldrRaw;
    envDoc["is_lux_calibrated"]     = false;

    if (dhtValid) {
        envDoc["sensor_health"]       = "HEALTHY";
        envDoc["is_sensor_available"] = true;
        envDoc["temperature_c"]       = round(temperature * 10.0) / 10.0;
        envDoc["humidity_pct"]        = round(humidity * 10.0) / 10.0;
        envDoc["error_details"]       = nullptr;
    } else {
        envDoc["sensor_health"]       = "FAULTED";
        envDoc["is_sensor_available"] = false;
        envDoc["temperature_c"]       = 0.0;
        envDoc["humidity_pct"]        = 0.0;
        envDoc["error_details"]       = "DHT22 read failure: sensor disconnected or checksum error";
        Serial.printf("[SENSOR WARN] DHT22 read failure! (T: %f, H: %f)\n", temperature, humidity);
    }

    String envPayload;
    serializeJson(envDoc, envPayload);
    sendCoAPPost("telemetry/environment", envPayload);
}
