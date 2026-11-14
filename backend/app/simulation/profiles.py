"""
Deterministic 24-hour Profiles for EcoWatt Grid Guard
Intervals: 96 steps per day (15-minute resolution)
"""
import numpy as np
from typing import Dict, List, Tuple


def get_time_string(step: int, interval_minutes: int = 15) -> str:
    """Convert step index (0..95) to HH:MM format."""
    total_minutes = step * interval_minutes
    hours = (total_minutes // 60) % 24
    mins = total_minutes % 60
    return f"{hours:02d}:{mins:02d}"


def generate_time_of_use_tariff(steps: int = 96) -> np.ndarray:
    """
    Time-of-Use (ToU) Electricity Tariff in Indian Rupees (₹/kWh):
    - Off-Peak (22:00 - 06:00): ₹4.50 / kWh (Baseload overnight incentive)
    - Normal / Shoulder (06:00 - 14:00, 20:00 - 22:00): ₹7.50 / kWh
    - On-Peak (14:00 - 20:00): ₹12.00 / kWh (Peak demand surcharge)
    """
    tariffs = np.zeros(steps)
    for s in range(steps):
        hour = (s * 15) / 60.0
        if 14.0 <= hour < 20.0:
            tariffs[s] = 12.00  # On-Peak
        elif (6.0 <= hour < 14.0) or (20.0 <= hour < 22.0):
            tariffs[s] = 7.50   # Shoulder
        else:
            tariffs[s] = 4.50   # Off-Peak
    return tariffs


def generate_grid_carbon_intensity(steps: int = 96) -> np.ndarray:
    """
    Time-Varying Grid Carbon Intensity (gCO2/kWh) Calibrated to Indian CEA National Baseline:
    
    Source Reference:
      Central Electricity Authority (CEA), Ministry of Power, Government of India:
      "CO2 Baseline Database for the Indian Power Sector", User Guide Version 19.0 (Nov 2023)
      and Version 20.0 (Oct 2024), covering the Indian National Synchronous Grid (NEWNE + SR).

    Baseline Empirical Factors:
      - Operating Margin (OM) Peaker Emission Factor: ~0.880 to 0.920 kg CO2/kWh (~880 gCO2/kWh)
      - Combined Margin (CM) Grid Weighted Average: ~0.790 to 0.812 kg CO2/kWh (~800 gCO2/kWh)
      - Build Margin (BM) Renewable/Low-Carbon Fraction: ~0.580 to 0.650 kg CO2/kWh (~580 gCO2/kWh)

    Diurnal Dynamic Dispatch Profile:
      - Solar Midday Depression (11:00 - 15:00 IST): High solar penetration (~60-75 GW nationally)
        displaces thermal coal marginal generation, depressing intensity to ~580.0 ± 25.0 gCO2/kWh.
      - Evening Peak Peaker Surge (17:00 - 21:00 IST): Solar generation drops to zero while national
        demand peaks (>240 GW). Subcritical/supercritical coal units and open-cycle gas peakers ramp to
        maximum dispatch, driving marginal carbon intensity to ~880.0 ± 35.0 gCO2/kWh.
      - Morning Ramp (07:00 - 10:00 IST): Commercial and industrial morning ramp-up before peak solar;
        grid intensity averages ~760.0 ± 20.0 gCO2/kWh.
      - Overnight Baseload (22:00 - 06:00 IST): Off-peak baseload coal generation supplemented by
        nocturnal wind power; grid intensity stabilizes at ~710.0 ± 15.0 gCO2/kWh.
    """
    carbon = np.zeros(steps)
    for s in range(steps):
        hour = (s * 15) / 60.0
        if 11.0 <= hour < 15.0:
            # Solar peak depression
            base = 580.0 + 25.0 * np.sin((hour - 11.0) / 4.0 * np.pi)
        elif 17.0 <= hour < 21.0:
            # Evening peaker thermal surge
            base = 880.0 + 35.0 * np.sin((hour - 17.0) / 4.0 * np.pi)
        elif 7.0 <= hour < 10.0:
            # Morning ramp
            base = 760.0 + 20.0 * np.sin((hour - 7.0) / 3.0 * np.pi)
        else:
            # Overnight baseline
            base = 710.0 + 15.0 * np.cos(hour / 24.0 * 2 * np.pi)
        carbon[s] = round(base, 1)
    return carbon


def generate_zone_occupancy_profiles(steps: int = 96, seed: int = 42) -> Dict[str, np.ndarray]:
    """
    Realistic deterministic occupancy headcount across 5 zones:
    1. Classroom (Max 35): Scheduled classes 09:00-12:00, 13:00-16:30
    2. Computer Laboratory (Max 40): Lab sessions 10:00-13:00, 14:00-18:00
    3. Office (Max 15): Staff hours 08:30-17:30
    4. Corridor (Max 25): Bursts between class changes
    5. Server Room (Max 3): Minimal maintenance entry
    """
    rng = np.random.RandomState(seed)
    occ = {
        "classroom": np.zeros(steps, dtype=int),
        "computer_lab": np.zeros(steps, dtype=int),
        "office": np.zeros(steps, dtype=int),
        "corridor": np.zeros(steps, dtype=int),
        "server_room": np.zeros(steps, dtype=int),
    }

    for s in range(steps):
        hour = (s * 15) / 60.0

        # 1. Classroom
        if 9.0 <= hour < 12.0:
            cls_occ = 28 + rng.randint(-3, 4)
        elif 12.0 <= hour < 13.0:
            cls_occ = 4 + rng.randint(-1, 3)
        elif 13.0 <= hour < 16.5:
            cls_occ = 32 + rng.randint(-2, 3)
        elif 16.5 <= hour < 18.0:
            cls_occ = 8 + rng.randint(-2, 3)
        else:
            cls_occ = 0
        occ["classroom"][s] = max(0, min(35, cls_occ))

        # 2. Computer Lab
        if 10.0 <= hour < 13.0:
            lab_occ = 34 + rng.randint(-3, 4)
        elif 13.0 <= hour < 14.0:
            lab_occ = 10 + rng.randint(-2, 3)
        elif 14.0 <= hour < 18.0:
            lab_occ = 36 + rng.randint(-2, 4)
        elif 18.0 <= hour < 20.0:
            lab_occ = 12 + rng.randint(-3, 3)
        else:
            lab_occ = 0
        occ["computer_lab"][s] = max(0, min(40, lab_occ))

        # 3. Office
        if 8.5 <= hour < 12.0:
            off_occ = 12 + rng.randint(-2, 3)
        elif 12.0 <= hour < 13.0:
            off_occ = 5 + rng.randint(-2, 3)
        elif 13.0 <= hour < 17.5:
            off_occ = 13 + rng.randint(-1, 3)
        elif 17.5 <= hour < 19.0:
            off_occ = 3 + rng.randint(-1, 2)
        else:
            off_occ = 0
        occ["office"][s] = max(0, min(15, off_occ))

        # 4. Corridor
        # Class change spikes around 10:00, 12:00, 14:00, 16:30
        trans_spike = 0
        for spike_hour in [9.0, 10.5, 12.0, 13.0, 14.5, 16.5, 18.0]:
            if abs(hour - spike_hour) < 0.25:
                trans_spike = 16 + rng.randint(-3, 5)
        if trans_spike > 0:
            cor_occ = trans_spike
        elif 8.0 <= hour < 19.0:
            cor_occ = 4 + rng.randint(-2, 3)
        else:
            cor_occ = 0
        occ["corridor"][s] = max(0, min(25, cor_occ))

        # 5. Server Room
        if (11.0 <= hour < 11.5) or (15.5 <= hour < 16.0):
            srv_occ = 1
        else:
            srv_occ = 0
        occ["server_room"][s] = max(0, min(3, srv_occ))

    return occ

