/**
 * Parse a finfocus config document.
 *
 * finfocus writes plain JSON and reads HuJSON: `//` and block comments, plus
 * trailing commas. Strings are left intact, including comment-like text.
 */
export function parseHujson(text: string): unknown {
  return JSON.parse(stripHuJson(text));
}

function stripHuJson(input: string): string {
  let out = '';
  let i = 0;
  const length = input.length;

  while (i < length) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      out += char;
      i += 1;
      while (i < length) {
        const stringChar = input[i];
        out += stringChar;
        if (stringChar === '\\' && i + 1 < length) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        i += 1;
        if (stringChar === '"') {
          break;
        }
      }
      continue;
    }

    if (char === '/' && next === '/') {
      i += 2;
      while (i < length && input[i] !== '\n') {
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < length && !(input[i] === '*' && input[i + 1] === '/')) {
        i += 1;
      }
      i = Math.min(length, i + 2);
      continue;
    }

    if (char === ',' && isTrailingComma(input, i + 1)) {
      i += 1;
      continue;
    }

    out += char;
    i += 1;
  }

  return out;
}

function isTrailingComma(input: string, start: number): boolean {
  let index = start;
  while (index < input.length) {
    const char = input[index];
    const next = input[index + 1];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      index += 2;
      while (index < input.length && input[index] !== '\n') {
        index += 1;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) {
        index += 1;
      }
      index = Math.min(input.length, index + 2);
      continue;
    }
    return char === '}' || char === ']';
  }
  return true;
}
