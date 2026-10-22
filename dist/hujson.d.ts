/**
 * Parse a finfocus config document.
 *
 * finfocus writes plain JSON and reads HuJSON: `//` and block comments, plus
 * trailing commas. Strings are left intact, including comment-like text.
 */
export declare function parseHujson(text: string): unknown;
