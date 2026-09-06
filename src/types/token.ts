export interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
  className?: string;
}

export interface TokenType {
  name: string;
  pattern: RegExp;
  className?: string;
  push?: string;
  pop?: boolean;
  /** Pop states through and including the named state. */
  popTo?: string;
}
