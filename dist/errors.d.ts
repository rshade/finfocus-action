import { FinfocusErrorEnvelope } from './types.js';
/**
 * Parse the JSON error envelope finfocus prints on stderr for non-zero exits.
 * Handles a bare JSON document as well as log lines preceding the envelope.
 * Returns undefined when stderr does not contain a valid envelope.
 */
export declare function parseErrorEnvelope(stderr: string): FinfocusErrorEnvelope | undefined;
/**
 * Format an error envelope into an actionable error message.
 * `validation_error` is a configuration error; `internal_error` is a finfocus
 * tool failure. Neither is ever a budget result.
 */
export declare function formatEnvelopeError(envelope: FinfocusErrorEnvelope, exitCode: number): string;
