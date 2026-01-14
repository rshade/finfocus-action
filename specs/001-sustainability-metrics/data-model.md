# Data Model: Sustainability Metrics

## Core Entities

### SustainabilityMetrics (Component of Resource)

Represents the raw sustainability data returned by `pulumicost` for a single resource.

| Field | Type | Description |
|-------|------|-------------|
| `gCO2e` | `object` | Grams of CO2 equivalent per month. |
| `gCO2e.value` | `number` | The numerical value. |
| `gCO2e.unit` | `string` | Unit (e.g., "gCO2e/month"). |
| `carbon_footprint` | `object` | Kilograms of CO2 equivalent per month (normalized). |
| `carbon_footprint.value` | `number` | The numerical value. |
| `carbon_footprint.unit` | `string` | Unit (e.g., "kgCO2e/month"). |

### SustainabilityReport (Aggregated)

Represents the aggregated sustainability data for the entire plan.

| Field | Type | Description |
|-------|------|-------------|
| `totalCO2e` | `number` | Total kgCO2e/month for the project. |
| `totalCO2eDiff` | `number` | Change in kgCO2e/month vs base (if available). |
| `carbonIntensity` | `number` | gCO2e per USD (Total gCO2e / Total Monthly Cost). |
| `resources` | `Resource[]` | List of resources with sustainability data, sorted by impact. |

### EquivalencyMetrics (Derived)

Relatable metrics derived from the total carbon footprint.

| Field | Type | Description |
|-------|------|-------------|
| `trees` | `number` | Equivalent annual tree offset. |
| `milesDriven` | `number` | Equivalent miles driven in an average passenger vehicle. |
| `homeElectricityDays` | `number` | Equivalent days of home electricity usage. |
