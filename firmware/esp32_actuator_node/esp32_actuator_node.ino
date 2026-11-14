/*
 * ==============================================================================
 * EcoWatt Grid Guard — Physical ESP32 Actuator Node Firmware (Reference Prototype)
 * ==============================================================================
 * Target Hardware: ESP32-WROOM-32D / ESP32-DevKitC
 * Protocol: MQTT 3.1.1 over TCP to EcoWatt MQTT Broker
 * Actuation Interfaces:
 *   - 4-Channel Active-Low Relay Module: GPIO25, GPIO26
 *   - Continuous PWM Modulation (Triac/MOSFET Dimmer): GPIO18 (LEDC Channel 0)
 *   - Hardware Critical-Load Protection Interlock Jumper: GPIO23 (Pullup, GND=Lock)
 *
 * NOTE: Reference prototype implementation pending physical field validation.
 * ==============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// --- Configuration Management ---
#if __has_include("secrets.h")
    #include "secrets.h"
#elif __has_include("../secrets.h")
    #include "../secrets.h"
#else
    #error "Missing secrets.h! Copy secrets.example.h to secrets.h and enter your Wi-Fi/Broker credentials."
#endif

// Compile-Time Configuration Sanity Checks
#ifndef ECOWATT_WIFI_SSID
    #error "ECOWATT_WIFI_SSID is not defined in secrets.h"
#endif
#ifndef ECOWATT_WIFI_PASSWORD
    #error "ECOWATT_WIFI_PASSWORD is not defined in secrets.h"
#endif
#ifndef ECOWATT_MQTT_HOST
    #error "ECOWATT_MQTT_HOST is not defined in secrets.h"
#endif
#ifndef ECOWATT_MQTT_PORT
    #define ECOWATT_MQTT_PORT 1883
#endif
#ifndef ECOWATT_NTP_SERVER
    #define ECOWATT_NTP_SERVER "pool.ntp.org"
#endif

// --- Node Metadata ---
const char* CLIENT_ID = "esp32_actuator_cls_hvac";
const char* LOAD_ID   = "cls_hvac";   // Target load controlled by this node
const bool IS_CRITICAL_LOAD = false;  // Set true for life-safety / server loads

// --- Hardware Pin Definitions ---
#define RELAY_CH1_PIN       25  // Binary Main Switch (Active-Low)
#define RELAY_CH2_PIN       26  // Auxiliary Switch (Active-Low)
#define PWM_DIMMER_PIN      18  // HVAC Compressor / Light Dimmer
#define CRITICAL_SAFETY_PIN 23  // Hardware interlock jumper (GND = Strict Lock)
#define STATUS_LED_PIN      2

// --- PWM Properties ---
const int PWM_FREQ       = 1000;
const int PWM_CHANNEL    = 0;
const int PWM_RESOLUTION = 8; // 8-bit (0 - 255)

// --- Operating Parameters ---
const float RATED_POWER_KW       = 1.40; // Nameplate rated capacity in kW
const float MIN_OPERATING_LEVEL  = 0.45; // Minimum allowable modulation level (HVAC compressor safety)
float currentOperatingLevel      = 1.0;  // 1.0 = 100% full power

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Pending ACK buffer for offline reconnect recovery
struct PendingAck {
    bool active;
    char commandId[36];
    char status[32];
    float operatingLevel;
    float estimatedPowerKw;
    float latencyMs;
    char timestamp[32];
};
const int MAX_PENDING_ACKS = 8;
PendingAck pendingAckBuffer[MAX_PENDING_ACKS];

void onMqttMessage(char* topic, byte* payload, unsigned int length);
bool sendOrBufferAck(const char* cmdId, const char* status, float level, float powerKw, unsigned long latencyMs);
void flushPendingAcks();
String getISOTimestamp(bool& isSynced);

void setup() {
    Serial.begin(115200);

    // =========================================================================
    // CRITICAL HARDWARE SAFETY: SAFE RELAY INITIALIZATION
    // =========================================================================
    // Active-Low Relays MUST be driven HIGH *before* setting as OUTPUT to avoid
    // an electrical startup glitch that would unintentionally energize the load!
    digitalWrite(RELAY_CH1_PIN, HIGH); // De-energized / Open
    digitalWrite(RELAY_CH2_PIN, HIGH);
    pinMode(RELAY_CH1_PIN, OUTPUT);
    pinMode(RELAY_CH2_PIN, OUTPUT);

    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
    pinMode(CRITICAL_SAFETY_PIN, INPUT_PULLUP); // Jumper to GND engages hard lock

    // Initialize PWM channel with safe 0 duty cycle at boot
    ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
    ledcAttachPin(PWM_DIMMER_PIN, PWM_CHANNEL);
    ledcWrite(PWM_CHANNEL, 0);

    // Initialize pending ACK buffer
    for (int i = 0; i < MAX_PENDING_ACKS; i++) pendingAckBuffer[i].active = false;

    Serial.println("\n=======================================================");
    Serial.println(" EcoWatt Grid Guard — ESP32 Actuator Node (Prototype) ");
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

    // NTP Time Synchronization
    configTime(0, 0, ECOWATT_NTP_SERVER, "time.google.com");
    Serial.println("[NTP] Synchronizing UTC clock for accurate ACK timestamps...");

    mqttClient.setServer(ECOWATT_MQTT_HOST, ECOWATT_MQTT_PORT);
    mqttClient.setCallback(onMqttMessage);
    mqttClient.setBufferSize(512);
}

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
    }
    if (!mqttClient.connected()) {
        connectMQTT();
    } else {
        flushPendingAcks();
    }
    mqttClient.loop();
    delay(10);
}

void connectWiFi() {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.printf("[WiFi] Connecting to %s", ECOWATT_WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ECOWATT_WIFI_SSID, ECOWATT_WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(400);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        digitalWrite(STATUS_LED_PIN, HIGH);
    } else {
        Serial.println("\n[WiFi] Connection timeout. Retrying later...");
    }
}

void connectMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;

    Serial.printf("[MQTT] Connecting to broker %s:%d...", ECOWATT_MQTT_HOST, ECOWATT_MQTT_PORT);
    bool connected = false;

    #if defined(ECOWATT_MQTT_USER) && (strlen(ECOWATT_MQTT_USER) > 0)
        connected = mqttClient.connect(CLIENT_ID, ECOWATT_MQTT_USER, ECOWATT_MQTT_PASS);
    #else
        connected = mqttClient.connect(CLIENT_ID);
    #endif

    if (connected) {
        Serial.println(" Connected!");
        char subTopic[64];
        snprintf(subTopic, sizeof(subTopic), "ecowatt/load/%s/command", LOAD_ID);
        mqttClient.subscribe(subTopic);
        Serial.printf("[MQTT] Subscribed to command topic: %s\n", subTopic);
        flushPendingAcks();
    } else {
        Serial.printf(" Connection failed (rc=%d). Will retry in loop.\n", mqttClient.state());
    }
}

String getISOTimestamp(bool& isSynced) {
    time_t nowSec = time(nullptr);
    if (nowSec > 1000000000) {
        isSynced = true;
        struct tm timeinfo;
        gmtime_r(&nowSec, &timeinfo);
        char buf[32];
        strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
        return String(buf);
    } else {
        isSynced = false;
        unsigned long sec = millis() / 1000;
        char buf[32];
        snprintf(buf, sizeof(buf), "1970-01-01T%02lu:%02lu:%02luZ", (sec / 3600) % 24, (sec / 60) % 60, sec % 60);
        return String(buf);
    }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    unsigned long startTime = millis();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, payload, length);

    if (err) {
        Serial.printf("[MQTT ERROR] JSON parse failed: %s\n", err.c_str());
        sendOrBufferAck("invalid_json", "REJECTED_INVALID_PAYLOAD", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
        return;
    }

    // --- Validation 1: Required Command ID ---
    if (!doc.containsKey("command_id") || !doc["command_id"].is<const char*>() || strlen(doc["command_id"]) == 0) {
        Serial.println("[Validation Error] Missing or invalid 'command_id' field.");
        sendOrBufferAck("missing_id", "REJECTED_INVALID_PAYLOAD", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
        return;
    }
    const char* commandId = doc["command_id"];

    // --- Validation 2: Load ID Verification (if specified in payload) ---
    if (doc.containsKey("load_id")) {
        const char* targetLoad = doc["load_id"];
        if (strcmp(targetLoad, LOAD_ID) != 0) {
            Serial.printf("[Validation Error] Command targeted load '%s', but this node controls '%s'\n", targetLoad, LOAD_ID);
            sendOrBufferAck(commandId, "REJECTED_LOAD_MISMATCH", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
            return;
        }
    }

    // --- Validation 3: Action Type ---
    if (!doc.containsKey("action") || !doc["action"].is<const char*>()) {
        sendOrBufferAck(commandId, "REJECTED_INVALID_PAYLOAD", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
        return;
    }
    const char* action = doc["action"];
    if (strcmp(action, "CURTAIL") != 0 && strcmp(action, "MODULATE") != 0 && strcmp(action, "RESTORE") != 0) {
        Serial.printf("[Validation Error] Unsupported action '%s'\n", action);
        sendOrBufferAck(commandId, "REJECTED_UNSUPPORTED_ACTION", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
        return;
    }

    // --- Validation 4: Operating Level Range ---
    if (doc.containsKey("requested_level")) {
        if (!doc["requested_level"].is<float>() && !doc["requested_level"].is<int>()) {
            sendOrBufferAck(commandId, "REJECTED_INVALID_OPERATING_LEVEL", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
            return;
        }
        float req = doc["requested_level"].as<float>();
        if (req < 0.0 || req > 1.0 || isnan(req)) {
            Serial.printf("[Validation Error] Requested level %.2f is out of bounds [0.0, 1.0]\n", req);
            sendOrBufferAck(commandId, "REJECTED_INVALID_OPERATING_LEVEL", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
            return;
        }
    }

    float requestedLevel = doc["requested_level"] | (strcmp(action, "RESTORE") == 0 ? 1.0f : (strcmp(action, "CURTAIL") == 0 ? 0.0f : currentOperatingLevel));

    // --- Safety Check 5: Hardware Safety Interlock & Critical Load Protection ---
    bool hardwareLocked = (digitalRead(CRITICAL_SAFETY_PIN) == LOW);
    if (IS_CRITICAL_LOAD || hardwareLocked) {
        if (strcmp(action, "CURTAIL") == 0 || requestedLevel < 1.0) {
            Serial.println("[SAFETY INTERLOCK] Command REJECTED: Critical load hardware protection is active!");
            sendOrBufferAck(commandId, "REJECTED_CRITICAL_PROTECTED", currentOperatingLevel, RATED_POWER_KW * currentOperatingLevel, millis() - startTime);
            return;
        }
    }

    // --- Physical Actuation Execution ---
    float targetLevel = requestedLevel;
    if (strcmp(action, "CURTAIL") == 0 && requestedLevel == 0.0) {
        targetLevel = 0.0;
        digitalWrite(RELAY_CH1_PIN, HIGH); // De-energize relay (disconnect AC load)
        ledcWrite(PWM_CHANNEL, 0);
    } else {
        // Enforce physical minimum operating level (compressor protection)
        targetLevel = max(MIN_OPERATING_LEVEL, min(1.0f, requestedLevel));
        digitalWrite(RELAY_CH1_PIN, LOW); // Energize relay (active-low)
        int pwmDuty = (int)(targetLevel * 255.0);
        ledcWrite(PWM_CHANNEL, pwmDuty);
    }

    currentOperatingLevel = targetLevel;
    // NOTE: This is an ESTIMATED power calculation from nameplate rating and modulation duty,
    // not a direct current transformer sensor reading!
    float estimatedPowerKw = round((RATED_POWER_KW * currentOperatingLevel) * 1000.0) / 1000.0;
    unsigned long latencyMs = millis() - startTime;

    Serial.printf("[Actuator] Executed %s: Level=%.2f, EstPower=%.3f kW in %lu ms\n", commandId, currentOperatingLevel, estimatedPowerKw, latencyMs);

    // --- Acknowledgement Dissemination ---
    sendOrBufferAck(commandId, "SUCCESS", currentOperatingLevel, estimatedPowerKw, latencyMs);
}

bool sendOrBufferAck(const char* cmdId, const char* status, float level, float powerKw, unsigned long latencyMs) {
    char ackTopic[64];
    snprintf(ackTopic, sizeof(ackTopic), "ecowatt/load/%s/ack", LOAD_ID);

    bool isSynced = false;
    String timestampStr = getISOTimestamp(isSynced);

    StaticJsonDocument<384> ackDoc;
    ackDoc["command_id"]         = cmdId;
    ackDoc["load_id"]            = LOAD_ID;
    ackDoc["status"]             = status;
    ackDoc["operating_level"]    = round(level * 100.0) / 100.0;
    // Clearly distinguish estimated power from physical transducer measurement:
    ackDoc["estimated_power_kw"] = powerKw;
    ackDoc["actual_power_kw"]    = powerKw; // Retained for backwards schema compatibility
    ackDoc["is_measured_power"]  = false;   // Explicitly flagged as calculated/estimated
    ackDoc["latency_ms"]         = (float)latencyMs;
    ackDoc["timestamp"]          = timestampStr;
    ackDoc["time_source"]        = isSynced ? "NTP_UTC" : "UPTIME_FALLBACK";

    char buffer[384];
    size_t len = serializeJson(ackDoc, buffer, sizeof(buffer));

    bool published = false;
    if (mqttClient.connected()) {
        published = mqttClient.publish(ackTopic, buffer, len);
    }

    if (published) {
        Serial.printf("[MQTT ACK] Published to %s (cmd=%s, status=%s)\n", ackTopic, cmdId, status);
        return true;
    } else {
        Serial.printf("[MQTT WARN] Failed to publish ACK. Buffering for reconnect (cmd=%s)\n", cmdId);
        // Store in pending buffer
        for (int i = 0; i < MAX_PENDING_ACKS; i++) {
            if (!pendingAckBuffer[i].active) {
                pendingAckBuffer[i].active = true;
                strncpy(pendingAckBuffer[i].commandId, cmdId, sizeof(pendingAckBuffer[i].commandId) - 1);
                strncpy(pendingAckBuffer[i].status, status, sizeof(pendingAckBuffer[i].status) - 1);
                pendingAckBuffer[i].operatingLevel = level;
                pendingAckBuffer[i].estimatedPowerKw = powerKw;
                pendingAckBuffer[i].latencyMs = (float)latencyMs;
                strncpy(pendingAckBuffer[i].timestamp, timestampStr.c_str(), sizeof(pendingAckBuffer[i].timestamp) - 1);
                break;
            }
        }
        return false;
    }
}

void flushPendingAcks() {
    if (!mqttClient.connected()) return;

    char ackTopic[64];
    snprintf(ackTopic, sizeof(ackTopic), "ecowatt/load/%s/ack", LOAD_ID);

    for (int i = 0; i < MAX_PENDING_ACKS; i++) {
        if (pendingAckBuffer[i].active) {
            StaticJsonDocument<384> ackDoc;
            ackDoc["command_id"]         = pendingAckBuffer[i].commandId;
            ackDoc["load_id"]            = LOAD_ID;
            ackDoc["status"]             = pendingAckBuffer[i].status;
            ackDoc["operating_level"]    = pendingAckBuffer[i].operatingLevel;
            ackDoc["estimated_power_kw"] = pendingAckBuffer[i].estimatedPowerKw;
            ackDoc["actual_power_kw"]    = pendingAckBuffer[i].estimatedPowerKw;
            ackDoc["is_measured_power"]  = false;
            ackDoc["latency_ms"]         = pendingAckBuffer[i].latencyMs;
            ackDoc["timestamp"]          = pendingAckBuffer[i].timestamp;
            ackDoc["retransmitted"]      = true;

            char buffer[384];
            size_t len = serializeJson(ackDoc, buffer, sizeof(buffer));
            if (mqttClient.publish(ackTopic, buffer, len)) {
                Serial.printf("[MQTT FLUSH] Retransmitted buffered ACK for cmd %s\n", pendingAckBuffer[i].commandId);
                pendingAckBuffer[i].active = false;
            } else {
                break; // Still unable to publish, retry on next loop
            }
        }
    }
}
