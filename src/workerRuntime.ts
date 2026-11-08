import { isMainThread, parentPort, workerData } from "node:worker_threads";

interface WorkerBootstrap {
  tokenizerPath: string;
  languagesPath: string;
}

interface WorkerRequest {
  id: number;
  type: "tokenize" | "tokenizeLine";
  language: string;
  options: import("./types/tokenizer").TokenizerOptions;
  code?: string;
  initialStateStack?: string[];
  line?: string;
  lineIndex?: number;
}

if (!isMainThread && parentPort) {
  const bootstrap = workerData as WorkerBootstrap;
  const { Tokenizer } = require(bootstrap.tokenizerPath) as typeof import("./core/Tokenizer");
  const { defaultRegistry } = require(bootstrap.languagesPath) as typeof import("./languages/Languages");

  const tokenizers = new Map<string, InstanceType<typeof Tokenizer>>();

  parentPort.on("message", (request: WorkerRequest) => {
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
      parentPort?.postMessage({ id: request.id, ok: true, result });
    } catch (error) {
      parentPort?.postMessage({
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
