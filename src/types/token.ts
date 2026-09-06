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
  context?: (
    line: string,
    position: number,
    tokens: Token[],
    stateStack: string[],
  ) => boolean;
  push?: string;
  pop?: boolean;
  /** Pop states through and including the named state. */
  popTo?: string;
  /** Pop only the contiguous embedded states with this prefix. */
  popPrefix?: string;
}
