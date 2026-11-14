/*
 * ==============================================================================
 * EcoWatt Grid Guard — Physical ESP32 Actuator Node Firmware
 * ==============================================================================
 * Target Hardware: ESP32-WROOM-32D / ESP32-DevKitC
 * Protocol: MQTT 3.1.1 over TCP to EcoWatt MQTT Broker (port 1883)
 * Actuation Interfaces:
 *   - 4-Channel Active-Low Relay Module: GPIO25, GPIO26, GPIO27, GPIO14
 *   - Continuous PWM Modulation (Triac/MOSFET Dimmer): GPIO18 (LEDC Channel 0)
 *   - Hardware Critical-Load Protection Interlock Jumper: GPIO23 (Pullup)
 * ==============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- Network & MQTT Broker Configuration ---
const char* WIFI_SSID     = "EcoWatt-IoT-Net";
const char* WIFI_PASSWORD = "SmartGridPassword2026";
const char* MQTT_BROKER   = "192.168.1.100";  // IP of Python Edge Gateway
const uint16_t MQTT_PORT  = 1883;

// --- Node Metadata ---
const char* CLIENT_ID = "esp32_actuator_cls_hvac";
const char* LOAD_ID   = "cls_hvac"; // Target load controlled by this node
const bool IS_CRITICAL_LOAD = false; // Set to true for server/emergency loads

// --- Hardware Pin Definitions ---
#define RELAY_CH1_PIN       25  // Binary Main Switch
#define RELAY_CH2_PIN       26  // Auxiliary Switch
#define PWM_DIMMER_PIN      18  // HVAC Compressor / Light Dimmer
#define CRITICAL_SAFETY_PIN 23  // Hardware interlock jumper (GND = Strict Lock)
#define STATUS_LED_PIN      2

// --- PWM Properties ---
const int PWM_FREQ       = 1000;
const int PWM_CHANNEL    = 0;
const int PWM_RESOLUTION = 8; // 8-bit (0 - 255)

WiFiClient espClient;
PubSubClient mqttClient(espClient);

float currentOperatingLevel = 1.0; // 100% full baseline power
float ratedPowerKw          = 1.40; // Rated capacity in kW

void setup() {
    Serial.begin(115200);
    pinMode(STATUS_LED_PIN, OUTPUT);
    pinMode(RELAY_CH1_PIN, OUTPUT);
    pinMode(RELAY_CH2_PIN, OUTPUT);
    pinMode(CRITICAL_SAFETY_PIN, INPUT_PULLUP);

    // Initial state: Relay energized (Normal closed, power ON)
    digitalWrite(RELAY_CH1_PIN, LOW); // Active Low
    digitalWrite(RELAY_CH2_PIN, LOW);

    // Setup PWM channel
    ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
    ledcAttachPin(PWM_DIMMER_PIN, PWM_CHANNEL);
    ledcWrite(PWM_CHANNEL, 255); // 100% duty cycle

    connectWiFi();
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(onMqttMessage);
}

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
    }
    if (!mqttClient.connected()) {
        connectMQTT();
    }
    mqttClient.loop();
    delay(10);
}

void connectWiFi() {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    digitalWrite(STATUS_LED_PIN, HIGH);
}

void connectMQTT() {
    while (!mqttClient.connected()) {
        Serial.printf("[MQTT] Connecting to broker %s:%d...", MQTT_BROKER, MQTT_PORT);
        if (mqttClient.connect(CLIENT_ID)) {
            Serial.println(" Connected!");
            // Subscribe to this load's command topic
            char subTopic[64];
            snprintf(subTopic, sizeof(subTopic), "ecowatt/load/%s/command", LOAD_ID);
            mqttClient.subscribe(subTopic);
            Serial.printf("[MQTT] Subscribed to topic: %s\n", subTopic);
        } else {
            Serial.printf(" Failed, rc=%d. Retrying in 3 seconds...\n", mqttClient.state());
            delay(3000);
        }
    }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    unsigned long startTime = millis();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, payload, length);
    if (err) {
        Serial.println("[MQTT] JSON parse failed on command payload.");
        return;
    }

    const char* commandId = doc["command_id"] | "unknown_cmd";
    const char* action    = doc["action"] | "MODULATE";
    float requestedLevel  = doc["requested_level"] | 1.0;

    Serial.printf("[Actuator] Received cmd %s: action=%s, requested_level=%.2f\n", commandId, action, requestedLevel);

    // 1. Hardware Interlock & Critical Protection Check
    bool hardwareLocked = (digitalRead(CRITICAL_SAFETY_PIN) == LOW);
    if (IS_CRITICAL_LOAD || hardwareLocked) {
        Serial.println("[Safety] Curtailment REJECTED: Critical load hardware interlock engaged!");
        sendAcknowledgement(commandId, "REJECTED_CRITICAL_PROTECTED", currentOperatingLevel, ratedPowerKw, millis() - startTime);
        return;
    }

    // 2. Physical Actuation
    // Clamp within physical minimum operating level (0.45 for HVAC compressor)
    float clampedLevel = max(0.45f, min(1.0f, requestedLevel));
    if (strcmp(action, "CURTAIL") == 0 && requestedLevel == 0.0) {
        // Binary cut-off
        clampedLevel = 0.0;
        digitalWrite(RELAY_CH1_PIN, HIGH); // De-energize relay
        ledcWrite(PWM_CHANNEL, 0);
    } else {
        // Continuous PWM modulation
        digitalWrite(RELAY_CH1_PIN, LOW); // Keep relay energized
        int pwmDuty = (int)(clampedLevel * 255.0);
        ledcWrite(PWM_CHANNEL, pwmDuty);
    }

    currentOperatingLevel = clampedLevel;
    float actualPowerKw = ratedPowerKw * currentOperatingLevel;
    unsigned long latencyMs = millis() - startTime;

    Serial.printf("[Actuator] Actuated to level %.2f (Power: %.2f kW) in %lu ms\n", currentOperatingLevel, actualPowerKw, latencyMs);

    // 3. Publish Execution Acknowledgement over MQTT
    sendAcknowledgement(commandId, "SUCCESS", currentOperatingLevel, actualPowerKw, latencyMs);
}

void sendAcknowledgement(const char* cmdId, const char* status, float level, float powerKw, unsigned long latencyMs) {
    char ackTopic[64];
    snprintf(ackTopic, sizeof(ackTopic), "ecowatt/load/%s/ack", LOAD_ID);

    StaticJsonDocument<256> ackDoc;
    ackDoc["command_id"]      = cmdId;
    ackDoc["load_id"]         = LOAD_ID;
    ackDoc["status"]          = status;
    ackDoc["actual_power_kw"] = round(powerKw * 1000.0) / 1000.0;
    ackDoc["operating_level"] = round(level * 100.0) / 100.0;
    ackDoc["latency_ms"]      = (float)latencyMs;
    ackDoc["timestamp"]       = "2026-11-14T12:00:00Z";

    char buffer[256];
    size_t len = serializeJson(ackDoc, buffer, sizeof(buffer));
    mqttClient.publish(ackTopic, buffer, len);
    Serial.printf("[MQTT] Disseminated ACK to %s: status=%s\n", ackTopic, status);
}
