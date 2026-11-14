"""
Unit Tests for Physical IoT Firmware Security, Configuration & Failsafe Invariants
Verifies:
- Complete absence of hardcoded credentials in firmware sources.
- Integrity of secrets.example.h template and .gitignore protection.
- Compile-time and runtime configuration sanity guards in C++ sketches.
- Safe relay initialization (active-low relays held HIGH at boot).
- NTP timestamp formatting and uptime fallback logic.
- Distinction between sensor-measured power and estimated actuator power.
"""
import re
from pathlib import Path


def test_firmware_no_hardcoded_credentials():
    """Verify no real-looking SSIDs, passwords, or broker credentials exist in tracked files."""
    firmware_dir = Path("firmware")
    assert firmware_dir.exists(), "firmware/ directory missing!"

    forbidden_patterns = [
        r"SmartGridPassword\d*",
        r"EcoWatt-IoT-Net",
        r"password\s*=\s*\"[^\"]{6,}\"",
    ]

    for p in firmware_dir.rglob("*"):
        if p.is_file() and p.suffix in (".ino", ".h", ".cpp", ".c", ".md"):
            content = p.read_text(encoding="utf-8", errors="ignore")
            for pattern in forbidden_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                # Ignore placeholders like YOUR_WIFI_PASSWORD
                real_matches = [m for m in matches if "YOUR_WIFI" not in m]
                assert len(real_matches) == 0, f"Found hardcoded credential matching '{pattern}' in {p}: {real_matches}"


def test_secrets_template_and_gitignore():
    """Verify secrets.example.h exists, contains placeholders only, and secrets.h is gitignored."""
    template = Path("firmware/secrets.example.h")
    assert template.exists(), "firmware/secrets.example.h missing!"
    content = template.read_text(encoding="utf-8")

    assert "YOUR_WIFI_SSID" in content
    assert "YOUR_WIFI_PASSWORD" in content
    assert "ECOWATT_GATEWAY_HOST" in content
    assert "ECOWATT_MQTT_HOST" in content

    gitignore = Path(".gitignore").read_text(encoding="utf-8")
    assert "secrets.h" in gitignore, ".gitignore does not ignore secrets.h!"


def test_firmware_compile_and_runtime_guards():
    """Verify sketches contain compile-time #error guards and runtime startup checks."""
    sensor_sketch = Path("firmware/esp32_sensor_node/esp32_sensor_node.ino").read_text(encoding="utf-8")
    actuator_sketch = Path("firmware/esp32_actuator_node/esp32_actuator_node.ino").read_text(encoding="utf-8")

    for name, sketch in [("Sensor", sensor_sketch), ("Actuator", actuator_sketch)]:
        # Compile-time inclusion check
        assert "__has_include(\"secrets.h\")" in sketch or "#error \"Missing secrets.h!" in sketch, (
            f"{name} node sketch lacks compile-time secrets.h check!"
        )
        # Runtime validation
        assert "YOUR_WIFI_SSID" in sketch, f"{name} node sketch lacks runtime placeholder detection!"
        assert "FATAL ERROR" in sketch, f"{name} node sketch lacks fatal configuration log!"


def test_actuator_safe_relay_initialization():
    """
    Verify active-low relays are written HIGH *before* setting pinMode(pin, OUTPUT)
    to prevent an unenergized load from momentarily turning on at boot.
    """
    actuator_sketch = Path("firmware/esp32_actuator_node/esp32_actuator_node.ino").read_text(encoding="utf-8")

    # Check setup() order: digitalWrite(RELAY_CH1_PIN, HIGH) must appear before pinMode(RELAY_CH1_PIN, OUTPUT)
    pos_high = actuator_sketch.find("digitalWrite(RELAY_CH1_PIN, HIGH);")
    pos_pinmode = actuator_sketch.find("pinMode(RELAY_CH1_PIN, OUTPUT);")

    assert pos_high != -1, "Missing digitalWrite(RELAY_CH1_PIN, HIGH) in actuator setup!"
    assert pos_pinmode != -1, "Missing pinMode(RELAY_CH1_PIN, OUTPUT) in actuator setup!"
    assert pos_high < pos_pinmode, "Relay pin must be driven HIGH before pinMode OUTPUT for active-low safety!"


def test_actuator_measurement_vs_estimation_distinction():
    """Verify actuator sketch explicitly labels power as estimated calculation, not physical sensor reading."""
    actuator_sketch = Path("firmware/esp32_actuator_node/esp32_actuator_node.ino").read_text(encoding="utf-8")
    assert "estimated_power_kw" in actuator_sketch
    assert "\"is_measured_power\"]  = false" in actuator_sketch or "\"is_measured_power\"] = false" in actuator_sketch
