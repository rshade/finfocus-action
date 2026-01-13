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
