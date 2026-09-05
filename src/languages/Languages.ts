import { LanguageDefinition } from '../types/language';
import { JavaScript } from './JavaScript';
import { TypeScript } from './TypeScript';
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

export const languages: Record<string, LanguageDefinition> = {
  javascript: new JavaScript(),
  typescript: new TypeScript(),
  python: new Python(),
  html: new HTML(),
  css: new CSS(),
  json: new JSON(),
  yaml: new YAML(),
  php: new PHP(),
  java: new Java(),
  xml: new XML(),
  cpp: new CPP(),
};

export const defaultRegistry = new LanguageRegistry();

for (const language of Object.values(languages)) {
  defaultRegistry.registerLanguage(language);
}