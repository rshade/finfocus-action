import * as fs from 'fs';
import * as path from 'path';
import { parseErrorEnvelope, formatEnvelopeError } from '../../src/errors.js';

describe('parseErrorEnvelope', () => {
  const fixtureDir = path.join(__dirname, '..', 'fixtures', 'finfocus-v0.4.0');

  it('parses the v0.4.0 validation_error envelope fixture (exit 2)', () => {
    const stderr = fs.readFileSync(path.join(fixtureDir, 'exit2-validation-error.json'), 'utf8');
    const envelope = parseErrorEnvelope(stderr);

    expect(envelope).toBeDefined();
    expect(envelope?.error_code).toBe('validation_error');
    expect(envelope?.message).toContain('loading Pulumi plan: reading plan file');
  });

  it('parses the v0.4.0 internal_error envelope fixture (exit 1)', () => {
    const stderr = fs.readFileSync(path.join(fixtureDir, 'exit1-no-pulumi-project.json'), 'utf8');
    const envelope = parseErrorEnvelope(stderr);

    expect(envelope).toBeDefined();
    expect(envelope?.error_code).toBe('internal_error');
    expect(envelope?.message).toContain('no Pulumi project found');
  });

  it('parses an envelope printed after log lines on stderr', () => {
    const fixture = fs
      .readFileSync(path.join(fixtureDir, 'exit2-validation-error.json'), 'utf8')
      .trim();
    const envelope = parseErrorEnvelope(`some log line\n${fixture}\n`);

    expect(envelope?.error_code).toBe('validation_error');
  });

  it('returns undefined for empty stderr', () => {
    expect(parseErrorEnvelope('')).toBeUndefined();
    expect(parseErrorEnvelope('   \n')).toBeUndefined();
  });

  it('returns undefined for non-JSON stderr', () => {
    expect(parseErrorEnvelope('command failed')).toBeUndefined();
  });

  it('returns undefined for JSON without the envelope fields', () => {
    expect(parseErrorEnvelope('{"foo":"bar"}')).toBeUndefined();
  });
});

describe('formatEnvelopeError', () => {
  it('labels validation_error as a configuration error', () => {
    const message = formatEnvelopeError(
      { error_code: 'validation_error', message: 'bad plan' },
      2,
    );
    expect(message).toContain('configuration error');
    expect(message).toContain('bad plan');
  });

  it('labels internal_error as a tool failure', () => {
    const message = formatEnvelopeError({ error_code: 'internal_error', message: 'boom' }, 1);
    expect(message).toContain('tool failure');
    expect(message).toContain('boom');
  });

  it('passes through unknown error codes', () => {
    const message = formatEnvelopeError({ error_code: 'weird', message: 'huh' }, 7);
    expect(message).toContain('weird');
    expect(message).toContain('huh');
  });
});
