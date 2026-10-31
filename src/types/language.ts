import { TokenType } from './token';

export interface LanguageDefinition {
  name: string;
  extensions: string[];
  aliases?: string[];
  getStates(): Record<string, TokenType[]>;
}