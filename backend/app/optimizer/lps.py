"""
Load Priority Score (LPS) Calculation Engine
Implements Section 9 Formulation:
  LPS_k(t) = w_s * S_k + w_o * (1 - Occ_j(t) / Occ_max,j) + w_p * (P_k(t) / P_max) + w_t * (Tariff(t) / Tariff_max)
"""
from typing import Dict, Any, Optional
from backend.app.core.config import settings


class LPSCalculator:
    """Calculates context-aware Load Priority Scores."""

    def __init__(
        self,
        w_s: float = settings.WEIGHT_SUITABILITY,
        w_o: float = settings.WEIGHT_OCCUPANCY,
        w_p: float = settings.WEIGHT_POWER,
        w_t: float = settings.WEIGHT_TARIFF,
        p_max: float = settings.MAX_REFERENCE_POWER_KW,
        tariff_max: float = settings.MAX_REFERENCE_TARIFF,
    ):
        self.w_s = w_s
        self.w_o = w_o
        self.w_p = w_p
        self.w_t = w_t
        self.p_max = max(0.1, p_max)
        self.tariff_max = max(0.01, tariff_max)
        self._validate_weights()

    def update_weights(self, w_s: float, w_o: float, w_p: float, w_t: float):
        """Update weights dynamically and validate."""
        self.w_s = max(0.0, w_s)
        self.w_o = max(0.0, w_o)
        self.w_p = max(0.0, w_p)
        self.w_t = max(0.0, w_t)
        self._validate_weights()

    def _validate_weights(self):
        total = self.w_s + self.w_o + self.w_p + self.w_t
        if total <= 0:
            raise ValueError("LPS weights sum must be strictly positive.")
        # Normalize in case of minor floating point rounding
        self.w_s = self.w_s / total
        self.w_o = self.w_o / total
        self.w_p = self.w_p / total
        self.w_t = self.w_t / total

    def calculate_lps(
        self,
        suitability_index: float,
        zone_occupancy: int,
        max_occupancy: int,
        current_power_kw: float,
        current_tariff: float,
        is_critical: bool = False,
    ) -> float:
        """
        Compute normalized LPS score.
        Critical loads always return 0.0 to exclude them from the curtailment queue.
        """
        if is_critical or suitability_index <= 0.0:
            return 0.0

        # Term 1: Curtailment Suitability Index (S_k in [0, 1])
        s_k = max(0.0, min(1.0, float(suitability_index)))

        # Term 2: Normalized Inverse Occupancy (1 - Occ_j / Occ_max,j)
        max_occ = max(1, int(max_occupancy))
        occ_ratio = max(0.0, min(1.0, float(zone_occupancy) / float(max_occ)))
        occ_inverse = 1.0 - occ_ratio

        # Term 3: Normalized Current Power (P_k / P_max)
        p_ratio = max(0.0, min(1.0, float(current_power_kw) / self.p_max))

        # Term 4: Normalized Tariff (Tariff / Tariff_max)
        tariff_ratio = max(0.0, min(1.0, float(current_tariff) / self.tariff_max))

        # Weighted Sum
        score = (
            self.w_s * s_k
            + self.w_o * occ_inverse
            + self.w_p * p_ratio
            + self.w_t * tariff_ratio
        )

        return round(float(score), 4)


# Global default instance
lps_calculator = LPSCalculator()
