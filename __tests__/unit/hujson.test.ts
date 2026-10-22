import { parseHujson } from '../../src/hujson.js';

describe('parseHujson', () => {
  it('parses plain JSON', () => {
    expect(parseHujson('{"amount": 5}')).toEqual({ amount: 5 });
  });

  it('drops comments and trailing commas without touching strings', () => {
    const parsed = parseHujson(`{
      // plugin install records
      "note": "keep // and /* inside strings",
      "installed_plugins": [
        {"name": "aws-public", "version": "v0.2.0",},
      ], /* trailing comma above */
    }`);

    expect(parsed).toEqual({
      note: 'keep // and /* inside strings',
      installed_plugins: [{ name: 'aws-public', version: 'v0.2.0' }],
    });
  });
});
