/**
 * C3 ID Generator Interface
 */

export interface IdGenerator {
  generate(prefix?: string): string;
}
