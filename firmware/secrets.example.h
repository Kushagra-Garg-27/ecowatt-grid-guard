#pragma once

/*
 * ==============================================================================
 * EcoWatt Grid Guard — Physical IoT Firmware Secrets & Network Configuration
 * ==============================================================================
 * INSTRUCTIONS:
 * 1. Copy this file to "secrets.h" in the same directory:
 *      cp secrets.example.h secrets.h
 * 2. Fill in your isolated Wi-Fi credentials, gateway host, and broker port.
 * 3. Never commit "secrets.h" to Git (it is tracked in .gitignore).
 * ==============================================================================
 */

// --- Wi-Fi Credentials ---
#define ECOWATT_WIFI_SSID     "YOUR_WIFI_SSID"
#define ECOWATT_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// --- Edge Gateway (CoAP UDP) Configuration ---
#define ECOWATT_GATEWAY_HOST  "192.168.1.100"  // IP or hostname of EcoWatt Edge Gateway
#define ECOWATT_COAP_PORT     5683             // Default CoAP UDP port (RFC 7252)

// --- MQTT Broker (TCP) Configuration ---
#define ECOWATT_MQTT_HOST     "192.168.1.100"  // IP or hostname of EcoWatt MQTT Broker
#define ECOWATT_MQTT_PORT     1883             // Default MQTT TCP port
#define ECOWATT_MQTT_USER     ""               // Optional MQTT username
#define ECOWATT_MQTT_PASS     ""               // Optional MQTT password

// --- Network Time Protocol (NTP) ---
#define ECOWATT_NTP_SERVER    "pool.ntp.org"
#define ECOWATT_NTP_BACKUP    "time.google.com"
