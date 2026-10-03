import { FinfocusErrorEnvelope } from './types.js';

/**
 * Parse the JSON error envelope finfocus prints on stderr for non-zero exits.
 * Handles a bare JSON document as well as log lines preceding the envelope.
 * Returns undefined when stderr does not contain a valid envelope.
 */
export function parseErrorEnvelope(stderr: string): FinfocusErrorEnvelope | undefined {
  const trimmed = stderr.trim();
  if (!trimmed) {
    return undefined;
  }

  const candidates = [trimmed];
  const lastLine = trimmed.split('\n').pop()?.trim();
  if (lastLine && lastLine !== trimmed) {
    candidates.push(lastLine);
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as Partial<FinfocusErrorEnvelope>;
      if (typeof parsed.error_code === 'string' && typeof parsed.message === 'string') {
        return parsed as FinfocusErrorEnvelope;
      }
    } catch {
      // not JSON, try the next candidate
    }
  }
  return undefined;
}

/**
 * Format an error envelope into an actionable error message.
 * `validation_error` is a configuration error; `internal_error` is a finfocus
 * tool failure. Neither is ever a budget result.
 */
export function formatEnvelopeError(envelope: FinfocusErrorEnvelope, exitCode: number): string {
  let kind: string;
  if (envelope.error_code === 'validation_error') {
    kind = 'configuration error';
  } else if (envelope.error_code === 'internal_error') {
    kind = 'tool failure';
  } else {
    kind = `error (${envelope.error_code})`;
  }
  return `finfocus ${kind} (exit ${exitCode}): ${envelope.message}`;
}
