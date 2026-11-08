import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";

export interface LanguageValidationResult {
  errors: string[];
  warnings: string[];
}

export class LanguageValidationError extends Error {
  public readonly issues: string[];

  constructor(languageName: string, issues: string[]) {
    super(`Invalid language definition "${languageName}": ${issues.join("; ")}`);
    this.name = "LanguageValidationError";
    this.issues = issues;
  }
}

export function validateLanguageDefinition(
  language: LanguageDefinition,
): LanguageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(language)) {
    return { errors: ["language definition must be an object"], warnings };
  }
  if (typeof language.name !== "string" || language.name.length === 0) {
    errors.push("name must be a non-empty string");
  }
  if (
    !Array.isArray(language.extensions) ||
    !language.extensions.every((extension) => typeof extension === "string")
  ) {
    errors.push("extensions must be an array of strings");
  }
  if (
    language.aliases !== undefined &&
    (!Array.isArray(language.aliases) ||
      !language.aliases.every((alias) => typeof alias === "string"))
  ) {
    errors.push("aliases must be an array of strings when provided");
  }
  if (
    language.lineIndexSensitive !== undefined &&
    typeof language.lineIndexSensitive !== "boolean"
  ) {
    errors.push("lineIndexSensitive must be a boolean when provided");
  }
  if (typeof language.getStates !== "function") {
    errors.push("getStates must be a function");
    return { errors, warnings };
  }

  let states: unknown;
  try {
    states = language.getStates();
  } catch (error) {
    errors.push(`getStates() threw: ${errorMessage(error)}`);
    return { errors, warnings };
  }

  const result = validateStates(states);
  return {
    errors: [...errors, ...result.errors],
    warnings: [...warnings, ...result.warnings],
  };
}

export function validateStates(states: unknown): LanguageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(states)) {
    return {
      errors: ["getStates() must return an object of state rule arrays"],
      warnings,
    };
  }

  const stateNames = Object.keys(states);
  if (!Object.prototype.hasOwnProperty.call(states, "root")) {
    errors.push('missing required "root" state');
  }

  let hasDynamicPush = false;
  const pushTargets: Array<{ where: string; target: string }> = [];
  const popTargets: Array<{ where: string; target: string }> = [];

  for (const stateName of stateNames) {
    const rules = states[stateName];
    if (!Array.isArray(rules)) {
      errors.push(`state "${stateName}" must contain an array of rules`);
      continue;
    }
    if (stateName.length === 0) {
      errors.push("state names must be non-empty strings");
    }

    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      const where = `state "${stateName}" rule ${index}`;
      if (!isRecord(rule)) {
        errors.push(`${where} must be a rule object`);
        continue;
      }
      if (typeof rule.name !== "string" || rule.name.length === 0) {
        errors.push(`${where} name must be a non-empty string`);
      }
      if (!(rule.pattern instanceof RegExp)) {
        errors.push(`${where} pattern must be a RegExp`);
        continue;
      }

      let matcher: RegExp | undefined;
      try {
        matcher = toStickyRegExp(rule.pattern);
      } catch (error) {
        errors.push(`${where} has an invalid pattern: ${errorMessage(error)}`);
      }

      validateOptionalType(rule, "context", "function", where, errors);
      validateOptionalType(rule, "pop", "boolean", where, errors);
      validateOptionalType(rule, "className", "string", where, errors);

      if (rule.push !== undefined) {
        if (typeof rule.push === "function") {
          hasDynamicPush = true;
        } else if (typeof rule.push === "string" && rule.push.length > 0) {
          pushTargets.push({ where, target: rule.push });
        } else {
          errors.push(`${where} push must be a state name or a resolver function`);
        }
      }
      if (rule.popTo !== undefined) {
        if (typeof rule.popTo === "string" && rule.popTo.length > 0) {
          popTargets.push({ where, target: rule.popTo });
        } else {
          errors.push(`${where} popTo must be a non-empty state name`);
        }
      }
      if (
        rule.popPrefix !== undefined &&
        (typeof rule.popPrefix !== "string" || rule.popPrefix.length === 0)
      ) {
        errors.push(`${where} popPrefix must be a non-empty string`);
      }

      if (matcher && canMatchEmpty(matcher)) {
        const reducesState =
          rule.pop === true ||
          typeof rule.popTo === "string" ||
          typeof rule.popPrefix === "string";
        if (!reducesState) {
          errors.push(
            `${where} can match an empty string without pop, popTo or popPrefix`,
          );
        }
      }

      if (rule.pattern instanceof RegExp && findNestedQuantifier(rule.pattern.source)) {
        warnings.push(
          `${where} contains a simple nested quantifier that may cause catastrophic backtracking`,
        );
      }
    }
  }

  for (const { where, target } of pushTargets) {
    if (!stateExists(states, target)) {
      errors.push(`${where} pushes unknown state "${target}"`);
    }
  }
  for (const { where, target } of popTargets) {
    if (!stateExists(states, target)) {
      errors.push(`${where} pops to unknown state "${target}"`);
    }
  }

  if (!hasDynamicPush && errors.length === 0) {
    const reachable = collectReachableStates(states);
    for (const stateName of stateNames) {
      if (!reachable.has(stateName)) {
        errors.push(`state "${stateName}" is unreachable from "root"`);
      }
    }
  }

  return { errors, warnings };
}

export function resolveBaseStateName(stateName: string): string {
  const separator = stateName.lastIndexOf(":");
  return separator > 0 ? stateName.slice(0, separator) : stateName;
}

function collectReachableStates(states: Record<string, unknown>): Set<string> {
  const reachable = new Set<string>();
  if (!Object.prototype.hasOwnProperty.call(states, "root")) {
    return reachable;
  }

  const queue: string[] = ["root"];
  reachable.add("root");
  while (queue.length > 0) {
    const stateName = queue.pop() as string;
    const rules = states[stateName];
    if (!Array.isArray(rules)) continue;
    for (const rule of rules) {
      if (!isRecord(rule) || typeof rule.push !== "string") continue;
      const target = resolveBaseStateName(rule.push);
      if (
        Object.prototype.hasOwnProperty.call(states, target) &&
        !reachable.has(target)
      ) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  return reachable;
}

function stateExists(
  states: Record<string, unknown>,
  stateName: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(states, stateName) ||
    Object.prototype.hasOwnProperty.call(states, resolveBaseStateName(stateName));
}

function validateOptionalType(
  rule: Record<string, unknown>,
  field: keyof TokenType,
  expected: "function" | "boolean" | "string",
  where: string,
  errors: string[],
): void {
  const value = rule[field];
  if (value !== undefined && typeof value !== expected) {
    errors.push(`${where} ${String(field)} must be a ${expected}`);
  }
}

function canMatchEmpty(pattern: RegExp): boolean {
  let matcher: RegExp;
  try {
    matcher = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""));
  } catch {
    return false;
  }
  if (matcher.test("")) return true;

  const samples = ["a", "0", " ", "\t", "\n", '"', "'", "/", "{", "`"];
  for (const sample of samples) {
    const match = matcher.exec(sample);
    if (match && match[0].length === 0) return true;
  }
  return false;
}

function findNestedQuantifier(source: string): boolean {
  const normalized = normalizeQuantifierSource(source);
  // Only flag the unambiguous shape `(atom+)+`, `(atom*)*`, `(?:atom+)*`, ...
  // Literal separators make the pattern ambiguous to evaluate statically and
  // are left to the author and the documentation.
  return /\((?:\?:)?(?:x|\.|[A-Za-z0-9_])[+*]\)[+*]/.test(normalized);
}

function normalizeQuantifierSource(source: string): string {
  let result = "";
  let inClass = false;
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      result += "x";
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (character === "]") {
        inClass = false;
        result += "x";
      }
      continue;
    }
    if (character === "[") {
      inClass = true;
      continue;
    }
    result += character;
  }
  return result;
}

function toStickyRegExp(pattern: RegExp): RegExp {
  if (pattern.sticky) {
    return new RegExp(pattern.source, pattern.flags);
  }
  return new RegExp(pattern.source, `${pattern.flags.replace("g", "")}y`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
