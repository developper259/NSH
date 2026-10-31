import { Token } from "./token";

export interface CachedLineState {
  text: string;
  tokens: Token[];
  stateBefore: string[];
  stateAfter: string[];
}

export interface InternalLineState extends CachedLineState {}

export interface IncrementalUpdate {
  startLine: number;
  deletedLines: number;
  insertedLines: number;
  retokenizedLines: number;
  changedStartLine: number;
  changedEndLine: number;
}
