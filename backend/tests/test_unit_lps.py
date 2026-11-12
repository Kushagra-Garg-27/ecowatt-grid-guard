"""
Unit Tests for Load Priority Score (LPS) Engine
Section 9 Requirements
"""
import pytest
from backend.app.optimizer.lps import LPSCalculator


def test_lps_standard_calculation():
    calc = LPSCalculator(w_s=0.4, w_o=0.2, w_p=0.2, w_t=0.2, p_max=10.0, tariff_max=0.50)

    # Suitability = 0.8, Occ = 10 / 40 (ratio 0.25, inverse 0.75), Power = 2.0 kW (ratio 0.20), Tariff = 0.40 (ratio 0.80)
    # Expected: 0.4*0.8 + 0.2*0.75 + 0.2*0.20 + 0.2*0.80
    # = 0.32 + 0.15 + 0.04 + 0.16 = 0.670
    score = calc.calculate_lps(
        suitability_index=0.8,
        zone_occupancy=10,
        max_occupancy=40,
        current_power_kw=2.0,
        current_tariff=0.40,
        is_critical=False,
    )
    assert abs(score - 0.670) < 1e-3


def test_critical_load_strictly_zero_lps():
    calc = LPSCalculator()
    # Critical load must strictly return 0.0 regardless of other parameters
    score = calc.calculate_lps(
        suitability_index=0.9,
        zone_occupancy=0,
        max_occupancy=30,
        current_power_kw=5.0,
        current_tariff=0.50,
        is_critical=True,
    )
    assert score == 0.0


def test_zero_suitability_returns_zero_lps():
    calc = LPSCalculator()
    score = calc.calculate_lps(
        suitability_index=0.0,
        zone_occupancy=5,
        max_occupancy=30,
        current_power_kw=3.0,
        current_tariff=0.25,
        is_critical=False,
    )
    assert score == 0.0


def test_division_by_zero_and_boundary_handling():
    calc = LPSCalculator(p_max=0.0, tariff_max=0.0)  # Should safely handle zero limits
    score = calc.calculate_lps(
        suitability_index=1.0,
        zone_occupancy=0,
        max_occupancy=0,  # Zero max occupancy
        current_power_kw=-2.0,  # Negative power clamped to 0
        current_tariff=1.0,  # Over tariff_max clamped
        is_critical=False,
    )
    assert score >= 0.0
    assert score <= 1.0


def test_weight_normalization():
    # Weights that don't sum to 1 should be normalized
    calc = LPSCalculator(w_s=2.0, w_o=1.0, w_p=1.0, w_t=1.0)
    assert abs((calc.w_s + calc.w_o + calc.w_p + calc.w_t) - 1.0) < 1e-4
    assert abs(calc.w_s - 0.40) < 1e-3
