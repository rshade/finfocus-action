export interface FinfocusSustainabilityMetric {
  value: number;
  unit: string;
}

export interface FinfocusSustainabilityData {
  gCO2e: FinfocusSustainabilityMetric;
  carbon_footprint: FinfocusSustainabilityMetric;
}

// Extends existing FinfocusResource
export interface SustainabilityResource extends FinfocusResource {
  sustainability?: FinfocusSustainabilityData;
}

export interface EquivalencyMetrics {
  trees: number; // Annual offset
  milesDriven: number;
  homeElectricityDays: number;
}

export interface SustainabilityReport {
  totalCO2e: number; // kgCO2e/month
  totalCO2eDiff: number; // kgCO2e/month
  carbonIntensity: number; // gCO2e/USD
  equivalents?: EquivalencyMetrics;
}
