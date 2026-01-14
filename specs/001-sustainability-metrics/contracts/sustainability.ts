export interface PulumicostSustainabilityMetric {
  value: number;
  unit: string;
}

export interface PulumicostSustainabilityData {
  gCO2e: PulumicostSustainabilityMetric;
  carbon_footprint: PulumicostSustainabilityMetric;
}

// Extends existing PulumicostResource
export interface SustainabilityResourceExtension {
  sustainability?: PulumicostSustainabilityData;
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
