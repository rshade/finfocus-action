import { IAnalyzer, PulumicostReport, ActionConfiguration } from './types.js';
export declare class Analyzer implements IAnalyzer {
    runAnalysis(planPath: string, config?: ActionConfiguration): Promise<PulumicostReport>;
    setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
    private findBinary;
}
