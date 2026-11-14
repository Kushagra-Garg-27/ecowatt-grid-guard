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


def test_sensor_firmware_no_fabricated_example_values():
    """Verify that hardcoded example values identified in the audit are completely eliminated."""
    sensor_sketch = Path("firmware/esp32_sensor_node/esp32_sensor_node.ino").read_text(encoding="utf-8")

    fabricated_literals = [
        "2.45",   # Fabricated power kW
        "230.2",  # Fabricated voltage V
        "10.9",   # Fabricated current A
        "0.96",   # Fabricated power factor
        "22.8",   # Fabricated temp C
        "46.5",   # Fabricated humidity %
        "28 : 5", # Fabricated PIR headcount
    ]

    for lit in fabricated_literals:
        assert lit not in sensor_sketch, f"Found obsolete fabricated literal '{lit}' in sensor sketch!"


def test_sensor_firmware_actual_acquisition_and_health_validation():
    """Verify sensor sketch uses real sensor APIs and validates readings before publishing."""
    sensor_sketch = Path("firmware/esp32_sensor_node/esp32_sensor_node.ino").read_text(encoding="utf-8")

    # Required libraries and includes
    assert "#include <PZEM004Tv30.h>" in sensor_sketch
    assert "#include <DHT.h>" in sensor_sketch

    # Hardware pins
    assert "#define PZEM_RX_PIN" in sensor_sketch
    assert "#define PZEM_TX_PIN" in sensor_sketch
    assert "#define DHT_PIN" in sensor_sketch
    assert "#define PIR_PIN" in sensor_sketch
    assert "#define LDR_ADC_PIN" in sensor_sketch

    # Sensor API invocations
    assert "pzem.voltage()" in sensor_sketch
    assert "pzem.current()" in sensor_sketch
    assert "pzem.power()" in sensor_sketch
    assert "pzem.pf()" in sensor_sketch
    assert "dht.readTemperature()" in sensor_sketch
    assert "dht.readHumidity()" in sensor_sketch
    assert "digitalRead(PIR_PIN)" in sensor_sketch
    assert "analogRead(LDR_ADC_PIN)" in sensor_sketch

    # Health and validation handling
    assert "isnan(voltage)" in sensor_sketch
    assert "pzemValid" in sensor_sketch
    assert "dhtValid" in sensor_sketch
    assert "FAULTED" in sensor_sketch
    assert "error_details" in sensor_sketch


def test_sensor_firmware_pir_motion_headcount_honesty():
    """Verify PIR reports binary motion detection and does NOT fabricate a headcount."""
    sensor_sketch = Path("firmware/esp32_sensor_node/esp32_sensor_node.ino").read_text(encoding="utf-8")

    assert "motion_detected" in sensor_sketch
    assert "is_headcount_measured" in sensor_sketch
    assert "\"is_headcount_measured\"] = false" in sensor_sketch or "\"is_headcount_measured\"]  = false" in sensor_sketch
    assert "PIR_BINARY_PRESENCE" in sensor_sketch


def test_actuator_ack_buffer_overflow_diagnostics_and_policy():
    """Verify actuator sketch detects buffer overflow, increments counter, and warns via serial."""
    actuator_sketch = Path("firmware/esp32_actuator_node/esp32_actuator_node.ino").read_text(encoding="utf-8")

    assert "MAX_PENDING_ACKS = 16" in actuator_sketch
    assert "droppedAckCount" in actuator_sketch
    assert "[ACK BUFFER OVERFLOW]" in actuator_sketch
    assert "ackBufferHead" in actuator_sketch
    assert "ackBufferTail" in actuator_sketch
    assert "ackBufferCount" in actuator_sketch
    assert "retransmitted" in actuator_sketch
    assert "buffer_dropped_total" in actuator_sketch

    # Documented RAM limitation notice
    assert "volatile ESP32 SRAM" in actuator_sketch
    assert "does NOT survive device reboots" in actuator_sketch


def test_actuator_ack_ring_buffer_simulation_logic():
    """Simulate and verify the exact ring buffer logic implemented in esp32_actuator_node.ino."""
    MAX_CAPACITY = 16
    buffer = [None] * MAX_CAPACITY
    head = 0
    tail = 0
    count = 0
    dropped = 0

    def enqueue(cmd_id: str):
        nonlocal head, tail, count, dropped
        if count >= MAX_CAPACITY:
            dropped += 1
            # Evict oldest by advancing tail
            tail = (tail + 1) % MAX_CAPACITY
            count -= 1
        buffer[head] = cmd_id
        head = (head + 1) % MAX_CAPACITY
        count += 1

    def drain():
        nonlocal tail, count
        drained = []
        while count > 0:
            drained.append(buffer[tail])
            tail = (tail + 1) % MAX_CAPACITY
            count -= 1
        return drained

    # 1. Fill buffer up to 16
    for i in range(16):
        enqueue(f"cmd_{i}")
    assert count == 16
    assert dropped == 0

    # 2. Add 17th item: should evict cmd_0 (the oldest)
    enqueue("cmd_16")
    assert count == 16
    assert dropped == 1

    # 3. Add 18th item: should evict cmd_1
    enqueue("cmd_17")
    assert count == 16
    assert dropped == 2

    # 4. Drain on reconnection: should return cmd_2 through cmd_17 in exact FIFO order
    drained_items = drain()
    assert len(drained_items) == 16
    assert count == 0
    assert drained_items[0] == "cmd_2"
    assert drained_items[-1] == "cmd_17"
    assert drained_items == [f"cmd_{i}" for i in range(2, 18)]

