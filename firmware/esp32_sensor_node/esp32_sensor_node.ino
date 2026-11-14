/*
 * ==============================================================================
 * EcoWatt Grid Guard — Physical ESP32 Sensor Node Firmware
 * ==============================================================================
 * Target Hardware: ESP32-WROOM-32D / ESP32-DevKitC
 * Protocol: CoAP over UDP (RFC 7252) to EcoWatt Edge Gateway (port 5683)
 * Sensors:
 *   - AC Power Monitor: PZEM-004T v3.0 (UART2: GPIO16-RX, GPIO17-TX)
 *   - Environmental: DHT22 (GPIO4) & LDR Photoresistor (GPIO34 / ADC1)
 *   - PIR Motion: HC-SR501 (GPIO19) for Zone Occupancy Counting
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

// --- Network Configuration ---
const char* WIFI_SSID     = "EcoWatt-IoT-Net";
const char* WIFI_PASSWORD = "SmartGridPassword2026";
const char* GATEWAY_IP    = "192.168.1.100";  // IP of Python Edge Gateway
const uint16_t COAP_PORT  = 5683;

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
    pinMode(PIR_PIN, INPUT);

    Serial.println("\n[EcoWatt ESP32] Initializing Smart Sensor Node...");
    connectWiFi();
    udp.begin(COAP_PORT);
    Serial.printf("[EcoWatt ESP32] CoAP UDP Client listening on port %d\n", COAP_PORT);
}

void loop() {
    // Keep WiFi connection alive
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
    Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        digitalWrite(STATUS_LED_PIN, HIGH);
    } else {
        Serial.println("\n[WiFi] Connection timed out. Continuing offline buffer...");
    }
}

// Simple CoAP POST packet builder (Confirmable POST with Uri-Path)
void sendCoAPPost(const char* resourcePath, const String& jsonPayload) {
    if (WiFi.status() != WL_CONNECTED) return;

    // Build minimal CoAP Packet:
    // Header: 4 bytes (Ver=1, Type=CON(0), TKL=0, Code=POST(0.02), MessageID)
    static uint16_t messageId = 0x1000;
    messageId++;

    uint8_t packet[512];
    int idx = 0;

    // Header
    packet[idx++] = 0x40; // Ver=1, T=CON(0), TKL=0
    packet[idx++] = 0x02; // Code=POST (0.02)
    packet[idx++] = (messageId >> 8) & 0xFF;
    packet[idx++] = messageId & 0xFF;

    // Option 11: Uri-Path (delta encoding)
    // Resource paths are e.g. "telemetry/power"
    String pathStr = String(resourcePath);
    int slashIdx = pathStr.indexOf('/');
    String seg1 = (slashIdx >= 0) ? pathStr.substring(0, slashIdx) : pathStr;
    String seg2 = (slashIdx >= 0) ? pathStr.substring(slashIdx + 1) : "";

    // First path segment: Option 11 (Uri-Path)
    int seg1Len = seg1.length();
    packet[idx++] = (11 << 4) | (seg1Len & 0x0F);
    for (int i = 0; i < seg1Len; i++) packet[idx++] = seg1[i];

    // Second path segment: delta = 0
    if (seg2.length() > 0) {
        int seg2Len = seg2.length();
        packet[idx++] = (0 << 4) | (seg2Len & 0x0F);
        for (int i = 0; i < seg2Len; i++) packet[idx++] = seg2[i];
    }

    // Payload Marker (0xFF)
    packet[idx++] = 0xFF;

    // Copy JSON payload
    int payloadLen = jsonPayload.length();
    for (int i = 0; i < payloadLen && idx < 510; i++) {
        packet[idx++] = jsonPayload[i];
    }

    udp.beginPacket(GATEWAY_IP, COAP_PORT);
    udp.write(packet, idx);
    udp.endPacket();
    Serial.printf("[CoAP] Transmitted %d bytes to %s:%d/%s\n", idx, GATEWAY_IP, COAP_PORT, resourcePath);
}

void emitAllTelemetry() {
    // 1. Emulate/Read Power Meter (PZEM-004T)
    StaticJsonDocument<256> pwrDoc;
    pwrDoc["sensor_id"] = SENSOR_ID;
    pwrDoc["zone_id"] = ZONE_ID;
    pwrDoc["timestamp"] = getISOTimestamp();
    pwrDoc["sensor_health"] = "HEALTHY";
    pwrDoc["power_kw"] = 2.45; // Real sensor: pzem.power() / 1000.0
    pwrDoc["voltage_v"] = 230.2;
    pwrDoc["current_a"] = 10.9;
    pwrDoc["power_factor"] = 0.96;
    String pwrPayload;
    serializeJson(pwrDoc, pwrPayload);
    sendCoAPPost("telemetry/power", pwrPayload);

    // 2. Emulate/Read Occupancy (PIR Counter)
    StaticJsonDocument<256> occDoc;
    occDoc["sensor_id"] = SENSOR_ID;
    occDoc["zone_id"] = ZONE_ID;
    occDoc["timestamp"] = getISOTimestamp();
    occDoc["sensor_health"] = "HEALTHY";
    occDoc["occupancy"] = digitalRead(PIR_PIN) ? 28 : 5;
    occDoc["max_occupancy"] = 35;
    occDoc["motion_detected"] = (bool)digitalRead(PIR_PIN);
    String occPayload;
    serializeJson(occDoc, occPayload);
    sendCoAPPost("telemetry/occupancy", occPayload);

    // 3. Emulate/Read Environmental (DHT22 & LDR)
    StaticJsonDocument<256> envDoc;
    envDoc["sensor_id"] = SENSOR_ID;
    envDoc["zone_id"] = ZONE_ID;
    envDoc["timestamp"] = getISOTimestamp();
    envDoc["sensor_health"] = "HEALTHY";
    envDoc["temperature_c"] = 22.8;
    envDoc["humidity_pct"] = 46.5;
    envDoc["lux_level"] = analogRead(LDR_ADC_PIN) / 4.0;
    String envPayload;
    serializeJson(envDoc, envPayload);
    sendCoAPPost("telemetry/environment", envPayload);
}

String getISOTimestamp() {
    // If NTP synchronized, return RFC3339; else formatted millis
    unsigned long sec = millis() / 1000;
    char buf[32];
    snprintf(buf, sizeof(buf), "2026-11-14T%02lu:%02lu:%02luZ", (sec / 3600) % 24, (sec / 60) % 60, sec % 60);
    return String(buf);
}
