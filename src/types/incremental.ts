import { Token } from "./token";

export interface CachedLineState {
  text: string;
  tokens: Token[];
  stateBefore: string[];
  stateAfter: string[];
}

/**
 * Stored form of a line. `stateBefore` is always the previous line's
 * `stateAfter` (or `["root"]` for the first line), so it is derived instead of
 * being stored again.
 */
export interface InternalLineState {
  text: string;
  tokens: Token[];
  stateAfter: string[];
}

export interface IncrementalUpdate {
  startLine: number;
  deletedLines: number;
  insertedLines: number;
  retokenizedLines: number;
  changedStartLine: number;
  changedEndLine: number;
}
