import { LanguageDefinition } from '../types/language';
import { JavaScript } from './JavaScript';
import { TypeScript } from './TypeScript';
import { JSX } from './JSX';
import { TSX } from './TSX';
import { Python } from './Python';
import { HTML } from './HTML';
import { CSS } from './CSS';
import { JSON } from './JSON';
import { YAML } from './YAML';
import { PHP } from './PHP';
import { Java } from './Java';
import { XML } from './XML';
import { CPP } from './CPP';
import { LanguageRegistry } from '../core/LanguageRegistry';
import { C } from './C';
import { CSV } from './CSV';
import { Markdown } from './Markdown';
import { Bash } from './Bash';
import { SQL } from './SQL';
import { Rust } from './Rust';
import { Go } from './Go';
import { SCSS } from './SCSS';
import { Sass } from './Sass';

export const languages: Record<string, LanguageDefinition> = {
  javascript: new JavaScript(),
  typescript: new TypeScript(),
  jsx: new JSX(),
  tsx: new TSX(),
  python: new Python(),
  html: new HTML(),
  css: new CSS(),
  json: new JSON(),
  yaml: new YAML(),
  php: new PHP(),
  java: new Java(),
  xml: new XML(),
  cpp: new CPP(),
  c: new C(),
  csv: new CSV(),
  markdown: new Markdown(),
  bash: new Bash(),
  sql: new SQL(),
  rust: new Rust(),
  go: new Go(),
  scss: new SCSS(),
  sass: new Sass(),
};

export const defaultRegistry = new LanguageRegistry();

for (const language of Object.values(languages)) {
  defaultRegistry.registerLanguage(language);
}