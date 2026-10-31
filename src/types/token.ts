export interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
  className?: string;
}

export type StatePushResolver = (
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
  matched: string,
) => string | undefined;

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
  push?: string | StatePushResolver;
  pop?: boolean;
  /** Pop states until the named state is on top. The target is kept on the stack. */
  popTo?: string;
  /** Pop only the contiguous embedded states with this prefix. */
  popPrefix?: string;
}
