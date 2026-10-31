import { EmbeddedLanguageOptions } from "../types/embedLanguage";
import { TokenType } from "../types/token";

export function createEmbeddedStates(
  options: EmbeddedLanguageOptions,
): Record<string, TokenType[]> {
  const {
    language,
    exitRule,
    prefix,
    exitMode = "host",
    skipExitStates = [],
  } = options;

  const childStates =
    typeof language.getStates === "function"
      ? language.getStates()
      : { root: language.getTokenTypes() };

  const embeddedStates: Record<string, TokenType[]> = {};

  for (const [stateName, rules] of Object.entries(childStates)) {
    const prefixedStateName =
      stateName === "root" ? `${prefix}root` : `${prefix}${stateName}`;
    const stateRules: TokenType[] = [];

    if (!skipExitStates.includes(stateName)) {
      stateRules.push(
        exitMode === "parent"
          ? { ...exitRule, popPrefix: prefix }
          : {
              ...exitRule,
              popTo: "root",
            },
      );
    }

    for (const rule of rules) {
      const clonedRule: TokenType = { ...rule };

      if (clonedRule.push !== undefined) {
        const push = clonedRule.push;
        clonedRule.push =
          typeof push === "string"
            ? prefixStateName(push, prefix)
            : (...args) => {
                const pushed = push(...args);
                return pushed === undefined ? undefined : prefixStateName(pushed, prefix);
              };
      }
      if (clonedRule.popTo) {
        clonedRule.popTo = prefixStateName(clonedRule.popTo, prefix);
      }
      if (clonedRule.popPrefix) {
        clonedRule.popPrefix = `${prefix}${clonedRule.popPrefix}`;
      }

      stateRules.push(clonedRule);
    }

    embeddedStates[prefixedStateName] = stateRules;
  }

  return embeddedStates;
}

function prefixStateName(stateName: string, prefix: string): string {
  return stateName.startsWith(prefix) ? stateName : `${prefix}${stateName}`;
}
