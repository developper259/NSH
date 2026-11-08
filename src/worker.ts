import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { Tokenizer } from "./core/Tokenizer";
import { defaultRegistry } from "./languages/Languages";
import type { LanguageDefinition } from "./types/language";
import type { Token } from "./types/token";
import type { TokenizerOptions } from "./types/tokenizer";

export class RegexTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`NSH tokenization exceeded the ${timeoutMs} ms worker timeout`);
    this.name = "RegexTimeoutError";
  }
}

export interface AsyncTokenizerOptions {
  /** Maximum time for one tokenization call. Defaults to 5000 ms. */
  timeoutMs?: number;
  /** Options forwarded to the Worker's Tokenizer instance. */
  tokenizerOptions?: TokenizerOptions;
}

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

interface WorkerSuccess {
  id: number;
  ok: true;
  result: { tokens: Token[]; finalStateStack: string[] };
}

interface WorkerFailure {
  id: number;
  ok: false;
  error: { name: string; message: string };
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

interface PendingRequest {
  resolve: (result: { tokens: Token[]; finalStateStack: string[] }) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 5000;

if (!isMainThread && parentPort) {
  startWorker();
}

export class AsyncTokenizer {
  private readonly languageName: string;
  private readonly timeoutMs: number;
  private readonly tokenizerOptions: TokenizerOptions;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private closed = false;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(languageName: string, options: AsyncTokenizerOptions = {}) {
    if (typeof languageName !== "string" || languageName.length === 0) {
      throw new TypeError("languageName must be a non-empty string");
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive integer");
    }
    this.languageName = languageName;
    this.timeoutMs = timeoutMs;
    this.tokenizerOptions = options.tokenizerOptions ?? {};
  }

  public tokenize(
    code: string,
    initialStateStack: string[] = ["root"],
  ): Promise<{ tokens: Token[]; finalStateStack: string[] }> {
    return this.send({
      type: "tokenize",
      language: this.languageName,
      options: this.tokenizerOptions,
      code,
      initialStateStack,
    });
  }

  public tokenizeLine(
    line: string,
    initialStateStack: string[] = ["root"],
    lineIndex = 0,
  ): Promise<{ tokens: Token[]; finalStateStack: string[] }> {
    return this.send({
      type: "tokenizeLine",
      language: this.languageName,
      options: this.tokenizerOptions,
      line,
      initialStateStack,
      lineIndex,
    });
  }

  public async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const worker = this.worker;
    this.worker = null;
    this.rejectPending(new Error("AsyncTokenizer is closed"));
    if (worker) {
      await worker.terminate();
    }
  }

  private send(
    request: Omit<WorkerRequest, "id">,
  ): Promise<{ tokens: Token[]; finalStateStack: string[] }> {
    if (this.closed) {
      return Promise.reject(new Error("AsyncTokenizer is closed"));
    }

    let worker: Worker;
    try {
      worker = this.ensureWorker();
    } catch (error) {
      return Promise.reject(error);
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.failWorker(new RegexTimeoutError(this.timeoutMs));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ ...request, id });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(__filename);
    this.worker = worker;
    worker.on("message", (response: WorkerResponse) => {
      const pending = this.pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve(response.result);
      } else {
        const error = new Error(response.error.message);
        error.name = response.error.name;
        pending.reject(error);
      }
    });
    worker.on("error", (error) => {
      if (this.worker === worker) {
        this.failWorker(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });
    worker.on("exit", (code) => {
      if (this.worker === worker) {
        this.failWorker(
          new Error(`NSH worker exited unexpectedly with code ${code}`),
        );
      }
    });
    return worker;
  }

  private failWorker(error: Error): void {
    const worker = this.worker;
    this.worker = null;
    this.rejectPending(error);
    if (worker) {
      void worker.terminate();
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function startWorker(): void {
  if (!parentPort) return;
  const tokenizers = new Map<string, Tokenizer>();

  parentPort.on("message", (request: WorkerRequest) => {
    try {
      const language = defaultRegistry.getLanguage(request.language);
      if (!language) {
        throw new Error(`Unsupported language: ${request.language}`);
      }
      const tokenizer = getWorkerTokenizer(
        tokenizers,
        language,
        request.language,
        request.options,
      );
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

function getWorkerTokenizer(
  tokenizers: Map<string, Tokenizer>,
  language: LanguageDefinition,
  languageName: string,
  options: TokenizerOptions,
): Tokenizer {
  const key = `${languageName.toLowerCase()}:${JSON.stringify(options)}`;
  let tokenizer = tokenizers.get(key);
  if (!tokenizer) {
    tokenizer = new Tokenizer(language, options);
    tokenizers.set(key, tokenizer);
  }
  return tokenizer;
}
