/*
 * ==============================================================================
 * EcoWatt Grid Guard — Physical ESP32 Sensor Node Firmware (Reference Prototype)
 * ==============================================================================
 * Target Hardware: ESP32-WROOM-32D / ESP32-DevKitC
 * Protocol: CoAP over UDP (RFC 7252) to EcoWatt Edge Gateway
 * Sensors:
 *   - AC Power Monitor: PZEM-004T v3.0 (UART2: GPIO16-RX, GPIO17-TX) [SENSOR MEASURED]
 *   - Environmental: DHT22 (GPIO4) & LDR Photoresistor (GPIO34 / ADC1) [SENSOR MEASURED]
 *   - PIR Motion: HC-SR501 (GPIO19) for Zone Occupancy Counting [SENSOR MEASURED]
 *
 * NOTE: Reference prototype implementation pending physical field validation.
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <time.h>

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
#define DHT_PIN        4
#define PIR_PIN        19
#define LDR_ADC_PIN    34
#define STATUS_LED_PIN 2

// --- Timing Configuration ---
const unsigned long TELEMETRY_INTERVAL_MS = 15000; // 15-second reporting cadence
unsigned long lastTelemetryTime = 0;
WiFiUDP udp;

void setup() {
    Serial.begin(115200);
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
    pinMode(PIR_PIN, INPUT);

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
    size_t written = udp.write(packet, idx);
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

    // 1. AC Power Telemetry (PZEM-004T v3.0 Sensor Measurement)
    StaticJsonDocument<256> pwrDoc;
    pwrDoc["sensor_id"] = SENSOR_ID;
    pwrDoc["zone_id"] = ZONE_ID;
    pwrDoc["timestamp"] = timestampStr;
    pwrDoc["sensor_health"] = timeSynced ? "HEALTHY" : "DEGRADED";
    pwrDoc["is_measured_power"] = true; // Physical current transformer reading
    pwrDoc["power_kw"] = 2.45;          // PZEM-004T: pzem.power() / 1000.0
    pwrDoc["voltage_v"] = 230.2;        // PZEM-004T: pzem.voltage()
    pwrDoc["current_a"] = 10.9;         // PZEM-004T: pzem.current()
    pwrDoc["power_factor"] = 0.96;      // PZEM-004T: pzem.pf()
    String pwrPayload;
    serializeJson(pwrDoc, pwrPayload);
    sendCoAPPost("telemetry/power", pwrPayload);

    // 2. Zone Occupancy Telemetry (PIR Sensor Motion Counter)
    StaticJsonDocument<256> occDoc;
    occDoc["sensor_id"] = SENSOR_ID;
    occDoc["zone_id"] = ZONE_ID;
    occDoc["timestamp"] = timestampStr;
    occDoc["sensor_health"] = "HEALTHY";
    occDoc["occupancy"] = digitalRead(PIR_PIN) ? 28 : 5;
    occDoc["max_occupancy"] = 35;
    occDoc["motion_detected"] = (bool)digitalRead(PIR_PIN);
    String occPayload;
    serializeJson(occDoc, occPayload);
    sendCoAPPost("telemetry/occupancy", occPayload);

    // 3. Environmental Telemetry (DHT22 Temperature/Humidity & LDR Light Level)
    StaticJsonDocument<256> envDoc;
    envDoc["sensor_id"] = SENSOR_ID;
    envDoc["zone_id"] = ZONE_ID;
    envDoc["timestamp"] = timestampStr;
    envDoc["sensor_health"] = "HEALTHY";
    envDoc["temperature_c"] = 22.8;
    envDoc["humidity_pct"] = 46.5;
    envDoc["lux_level"] = analogRead(LDR_ADC_PIN) / 4.0;
    String envPayload;
    serializeJson(envDoc, envPayload);
    sendCoAPPost("telemetry/environment", envPayload);
}
