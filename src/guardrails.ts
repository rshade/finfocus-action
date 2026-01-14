import * as core from '@actions/core';

export function checkThreshold(threshold: string | null, diff: number, currency: string): boolean {
  if (!threshold) return false;

  const regex = /^(\d+(\.\d{1,2})?)([A-Z]{3})$/;
  const match = threshold.match(regex);

  if (!match) {
    core.warning(
      `Malformed threshold input: "${threshold}". Expected format like "100USD". Skipping guardrail.`,
    );
    return false;
  }

  const limitValue = parseFloat(match[1]);
  const limitCurrency = match[3];

  if (limitCurrency !== currency) {
    core.warning(
      `Currency mismatch in threshold. Threshold: ${limitCurrency}, Report: ${currency}. Skipping guardrail.`,
    );
    return false;
  }

  if (diff > limitValue) {
    return true;
  }

  return false;
}

export function checkCarbonThreshold(
  threshold: string | null,
  diff: number,
  baseTotal: number,
): boolean {
  if (!threshold) return false;

  // Pattern for absolute: "10kg", "10.5kgCO2e", etc.
  // Pattern for percent: "10%"
  const absRegex = /^(\d+(\.\d{1,2})?)(kg|kgCO2e)?$/i;
  const pctRegex = /^(\d+(\.\d{1,2})?)%$/;

  const absMatch = threshold.match(absRegex);
  const pctMatch = threshold.match(pctRegex);

  if (absMatch) {
    const limitValue = parseFloat(absMatch[1]);
    return diff > limitValue;
  }

  if (pctMatch) {
    const limitPct = parseFloat(pctMatch[1]);
    if (baseTotal <= 0) return false; // Avoid division by zero or nonsensical checks
    const currentPct = (diff / baseTotal) * 100;
    return currentPct > limitPct;
  }

  core.warning(
    `Malformed carbon threshold input: "${threshold}". Expected format like "10kg" or "10%". Skipping guardrail.`,
  );
  return false;
}
