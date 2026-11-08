import { isMainThread, parentPort } from "node:worker_threads";
import { Tokenizer } from "./core/Tokenizer";
import { defaultRegistry } from "./languages/Languages";
import type { TokenizerOptions } from "./types/tokenizer";

interface WorkerRequest {
  id: number;
  type: "tokenize" | "tokenizeLine";
  language: string;
  options: TokenizerOptions;
  code?: string;
  initialStateStack?: string[];
  line?: string;
  lineIndex?: number;
}

if (!isMainThread && parentPort) {
  const port = parentPort;
  const tokenizers = new Map<string, Tokenizer>();

  port.on("message", (request: WorkerRequest) => {
    try {
      const language = defaultRegistry.getLanguage(request.language);
      if (!language) {
        throw new Error(`Unsupported language: ${request.language}`);
      }
      const key = `${request.language.toLowerCase()}:${JSON.stringify(request.options)}`;
      let tokenizer = tokenizers.get(key);
      if (!tokenizer) {
        tokenizer = new Tokenizer(language, request.options);
        tokenizers.set(key, tokenizer);
      }
      const result =
        request.type === "tokenize"
          ? tokenizer.tokenizeWithState(
              request.code ?? "",
              request.initialStateStack ?? ["root"],
            )
          : tokenizer.tokenizeLine(
              request.line ?? "",
              request.initialStateStack ?? ["root"],
              request.lineIndex ?? 0,
            );
      port.postMessage({ id: request.id, ok: true, result });
    } catch (error) {
      port.postMessage({
        id: request.id,
        ok: false,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
}
