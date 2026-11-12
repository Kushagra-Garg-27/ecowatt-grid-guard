# EcoWatt Grid Guard — Configuration Specifications

This directory contains reference and default configuration schemas for EcoWatt Grid Guard.

## Files
* `default_config.json`: Canonical parameters for the 5-zone educational building testbed.
  * **Threshold ($P_{\text{threshold}}$):** 7.00 kW
  * **Reserve Margin ($P_{\text{margin}}$):** 0.20 kW
  * **Target Demand ($P_{\text{target}}$):** 6.80 kW
  * **LPS Weights:** $w_s=0.35, w_o=0.25, w_p=0.20, w_t=0.20$
  * **Tariffs:** Commercial Time-of-Use rates in Indian Rupees (₹)
  * **Grid Carbon:** Calibrated to CEA India Grid Baseline Database

## Environment Overrides
To override defaults, copy `.env.example` to `.env` in the project root or `backend/` and modify desired environment variables.
