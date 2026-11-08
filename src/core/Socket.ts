import { WebSocketServer, WebSocket, RawData } from "ws";

import { Highlighter } from "./Highlighter";
import { Tokenizer } from "./Tokenizer";
import { IncrementalDocument } from "./IncrementalDocument";
import { defaultRegistry } from "../languages/Languages";
import {
  DetectLanguageResponse,
  HighlightRequest,
  HighlightResponse,
  NSHServerAuthenticate,
  NSHServerOptions,
  ServerClientState,
  ServerUpgradeInfo,
  ServerValidationLimits,
  ServerVerifyClientDone,
  SupportedLanguageResponse,
} from "../types/socket";

const DEFAULT_MAX_PAYLOAD = 2 * 1024 * 1024;
const DEFAULT_MAX_CLIENTS = 64;
const DEFAULT_MAX_DOCUMENTS = 32;
const DEFAULT_MAX_DOCUMENT_CHARACTERS = 1024 * 1024;
const DEFAULT_MAX_CLIENT_DOCUMENT_CHARACTERS = 4 * 1024 * 1024;
const DEFAULT_MAX_REQUESTS_PER_SECOND = 120;
const DEFAULT_MAX_REQUEST_BURST = 240;
const DEFAULT_MAX_LINES_PER_REQUEST = 5000;
const DEFAULT_MAX_STATE_DEPTH = 64;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const LOOPBACK_ORIGIN_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CLOSE_TIMEOUT_MS = 500;

export class NSHServer {
  private readonly configuredPort: number;
  private port: number;
  private readonly host: string;
  private readonly maxPayload: number;
  private readonly maxClients: number;
  private readonly maxDocumentsPerClient: number;
  private readonly maxDocumentCharacters: number;
  private readonly maxClientDocumentCharacters: number;
  private readonly maxRequestsPerSecond: number;
  private readonly maxRequestBurst: number;
  private readonly maxLinesPerRequest: number;
  private readonly maxStateDepth: number;
  private readonly heartbeatIntervalMs: number;
  private readonly allowedOrigins: string[];
  private readonly allowMissingOrigin: boolean;
  private readonly allowNullOrigin: boolean;
  private readonly authenticate: NSHServerAuthenticate | undefined;

  private wss: WebSocketServer | null = null;
  private listening = false;
  private startPromise: Promise<number> | null = null;
  private startReject: ((error: Error) => void) | null = null;
  private stopPromise: Promise<void> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly aliveClients = new WeakMap<WebSocket, boolean>();
  private readonly tokenizers = new Map<string, Tokenizer>();
  private readonly clients = new Map<WebSocket, ServerClientState>();
  private lastError: Error | null = null;

  constructor(options: number | NSHServerOptions = 0) {
    const config = typeof options === "number" ? { port: options } : options;
    this.configuredPort = config.port ?? 0;
    this.port = this.configuredPort;
    this.host = config.host ?? "127.0.0.1";
    this.maxPayload = requirePositiveInteger(config.maxPayload ?? DEFAULT_MAX_PAYLOAD, "maxPayload");
    this.maxClients = requireNonNegativeInteger(config.maxClients ?? DEFAULT_MAX_CLIENTS, "maxClients");
    this.maxDocumentsPerClient = requireNonNegativeInteger(
      config.maxDocumentsPerClient ?? DEFAULT_MAX_DOCUMENTS,
      "maxDocumentsPerClient",
    );
    this.maxDocumentCharacters = requireNonNegativeInteger(
      config.maxDocumentCharacters ?? DEFAULT_MAX_DOCUMENT_CHARACTERS,
      "maxDocumentCharacters",
    );
    this.maxClientDocumentCharacters = requireNonNegativeInteger(
      config.maxClientDocumentCharacters ?? DEFAULT_MAX_CLIENT_DOCUMENT_CHARACTERS,
      "maxClientDocumentCharacters",
    );
    this.maxRequestsPerSecond = requireNonNegativeInteger(
      config.maxRequestsPerSecond ?? DEFAULT_MAX_REQUESTS_PER_SECOND,
      "maxRequestsPerSecond",
    );
    this.maxRequestBurst = Math.max(
      1,
      requireNonNegativeInteger(config.maxRequestBurst ?? DEFAULT_MAX_REQUEST_BURST, "maxRequestBurst"),
    );
    this.maxLinesPerRequest = requireNonNegativeInteger(
      config.maxLinesPerRequest ?? DEFAULT_MAX_LINES_PER_REQUEST,
      "maxLinesPerRequest",
    );
    this.maxStateDepth = requirePositiveInteger(
      config.maxStateDepth ?? DEFAULT_MAX_STATE_DEPTH,
      "maxStateDepth",
    );
    this.heartbeatIntervalMs = requireNonNegativeInteger(
      config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL,
      "heartbeatIntervalMs",
    );
    this.allowedOrigins = (config.allowedOrigins ?? []).map(normalizeOrigin);
    this.allowMissingOrigin = config.allowMissingOrigin ?? true;
    this.allowNullOrigin = config.allowNullOrigin ?? false;
    this.authenticate = config.authenticate;

    if (!LOOPBACK_HOSTS.has(this.host) && !this.authenticate) {
      throw new Error("authenticate is required when the server binds to a non-loopback host");
    }
  }

  public async start(): Promise<number> {
    if (this.stopPromise) {
      await this.stopPromise;
    }
    if (this.wss && this.startPromise) {
      return this.startPromise;
    }
    if (this.wss) {
      return this.port;
    }

    this.lastError = null;
    const server = new WebSocketServer({
      host: this.host,
      port: this.configuredPort,
      maxPayload: this.maxPayload,
      verifyClient: (info, done) => {
        void this.verifyClient(info, done);
      },
    });
    this.wss = server;
    server.on("connection", (ws: WebSocket) => this.handleConnection(ws));
    server.on("error", (error: Error) => this.handleServerError(error));

    this.startPromise = new Promise<number>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        server.removeListener("listening", onListening);
        server.removeListener("error", onError);
        this.startReject = null;
      };
      const settle = (error?: Error, port?: number): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          if (this.wss === server) {
            this.wss = null;
            this.listening = false;
          }
          this.startPromise = null;
          reject(error);
          return;
        }
        if (port === undefined) {
          this.startPromise = null;
          reject(new Error("NSH server did not expose a TCP port"));
          return;
        }
        this.port = port;
        this.listening = true;
        this.startHeartbeat(server);
        resolve(port);
      };
      const onListening = (): void => {
        const address = server.address();
        if (!address || typeof address === "string") {
          settle(new Error("NSH server did not expose a TCP port"));
          return;
        }
        settle(undefined, address.port);
      };
      const onError = (error: Error): void => {
        settle(error);
      };

      this.startReject = (error: Error): void => {
        settle(error);
      };
      server.once("listening", onListening);
      server.once("error", onError);
    });

    return this.startPromise;
  }

  public getPort(): number | null {
    return this.wss && this.listening ? this.port : null;
  }

  public getConnectionCount(): number {
    return this.clients.size;
  }

  public getDocumentCount(): number {
    let count = 0;
    for (const client of this.clients.values()) {
      count += client.documents.size;
    }
    return count;
  }

  public getLastError(): Error | null {
    return this.lastError;
  }

  public stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    const server = this.wss;
    if (!server) {
      this.rejectPendingStart();
      this.port = this.configuredPort;
      this.listening = false;
      this.startPromise = null;
      return Promise.resolve();
    }

    this.stopPromise = new Promise<void>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const done = (): void => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        this.stopHeartbeat();
        this.clients.clear();
        this.tokenizers.clear();
        if (this.wss === server) {
          this.wss = null;
        }
        this.listening = false;
        this.startPromise = null;
        this.startReject = null;
        this.port = this.configuredPort;
        this.stopPromise = null;
        resolve();
      };

      this.rejectPendingStart();
      for (const client of server.clients) {
        client.close();
      }
      timeout = setTimeout(() => {
        for (const client of server.clients) {
          client.terminate();
        }
        done();
      }, CLOSE_TIMEOUT_MS);
      timeout.unref?.();
      server.close(() => done());
    });

    return this.stopPromise;
  }

  private rejectPendingStart(): void {
    if (this.startReject) {
      this.startReject(new Error("NSH server stopped before it started"));
    }
  }

  private async verifyClient(
    info: ServerUpgradeInfo,
    done: ServerVerifyClientDone,
  ): Promise<void> {
    if (!this.isOriginAllowed(info.origin)) {
      done(false, 403, "Origin not allowed");
      return;
    }
    if (this.maxClients > 0 && (this.wss?.clients.size ?? 0) >= this.maxClients) {
      done(false, 503, "Server at capacity");
      return;
    }
    if (this.authenticate) {
      try {
        if (!(await this.authenticate(info.req))) {
          done(false, 401, "Unauthorized");
          return;
        }
      } catch {
        done(false, 401, "Unauthorized");
        return;
      }
    }
    done(true);
  }

  private isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
      return this.allowMissingOrigin;
    }
    if (origin === "null") {
      return this.allowNullOrigin;
    }
    if (this.allowedOrigins.includes("*")) {
      return true;
    }
    if (this.allowedOrigins.length === 0) {
      return isLoopbackOrigin(origin);
    }
    const normalized = normalizeOrigin(origin);
    return this.allowedOrigins.includes(normalized);
  }

  private handleServerError(error: Error): void {
    this.lastError = error;
    if (this.listening) {
      void this.stop();
    }
  }

  private startHeartbeat(server: WebSocketServer): void {
    if (this.heartbeatIntervalMs <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      for (const client of server.clients) {
        if (this.aliveClients.get(client) === false) {
          client.terminate();
          continue;
        }
        this.aliveClients.set(client, false);
        client.ping();
      }
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleConnection(ws: WebSocket): void {
    const state: ServerClientState = {
      documents: new Map(),
      documentCharacters: 0,
      tokens: this.maxRequestBurst,
      lastRefill: Date.now(),
      rejectedRequests: 0,
    };
    this.clients.set(ws, state);
    this.aliveClients.set(ws, true);
    ws.on("message", (message: RawData) => this.handleMessage(ws, message));
    ws.on("error", () => undefined);
    ws.on("pong", () => this.aliveClients.set(ws, true));
    ws.on("close", () => {
      this.clients.delete(ws);
      this.aliveClients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: RawData): void {
    const state = this.clients.get(ws);
    if (!state) return;
    if (!this.consumeRequestToken(state)) {
      this.sendError(ws, undefined, "Rate limit exceeded");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawDataToString(message));
    } catch {
      this.sendError(ws, undefined, "Invalid JSON");
      return;
    }

    const id = getRequestId(parsed);
    const limits: ServerValidationLimits = {
      maxStateDepth: this.maxStateDepth,
      maxLinesPerRequest: this.maxLinesPerRequest,
      maxDocumentCharacters: this.maxDocumentCharacters,
    };
    const validationError = validateRequest(parsed, limits);
    if (validationError) {
      this.sendError(ws, id, validationError);
      return;
    }

    const request = parsed as HighlightRequest;
    if (request.requestType === "highlight") {
      this.handleHighlight(ws, request);
    } else if (request.requestType === "highlightLine") {
      this.handleHighlightLine(ws, request);
    } else if (request.requestType === "supportedLanguages") {
      this.handleSupportedLanguages(ws, request);
    } else if (request.requestType === "detectLanguage") {
      this.handleDetectLanguage(ws, request);
    } else if (request.requestType === "openDocument") {
      this.handleOpenDocument(ws, request);
    } else if (request.requestType === "updateDocument") {
      this.handleUpdateDocument(ws, request);
    } else if (request.requestType === "closeDocument") {
      this.handleCloseDocument(ws, request);
    } else if (request.requestType === "getDocumentLines") {
      this.handleGetDocumentLines(ws, request);
    }
  }

  private consumeRequestToken(state: ServerClientState): boolean {
    if (this.maxRequestsPerSecond <= 0) return true;
    const now = Date.now();
    const elapsedSeconds = Math.max(0, now - state.lastRefill) / 1000;
    state.tokens = Math.min(
      this.maxRequestBurst,
      state.tokens + elapsedSeconds * this.maxRequestsPerSecond,
    );
    state.lastRefill = now;
    if (state.tokens < 1) {
      state.rejectedRequests += 1;
      return false;
    }
    state.tokens -= 1;
    state.rejectedRequests = 0;
    return true;
  }

  private handleHighlight(ws: WebSocket, request: HighlightRequest): void {
    const languageDef = defaultRegistry.getLanguage(request.language as string);
    if (!languageDef) {
      this.sendError(ws, request.id, `Unsupported language: ${request.language}`);
      return;
    }

    try {
      const highlighter = this.createHighlighter(
        request.language as string,
        languageDef,
        request.options,
      );
      const code = request.code as string;
      const responseType = request.responseType ?? "html";
      const response: HighlightResponse = { id: request.id, success: true };

      if (responseType === "html") {
        response.html = highlighter.getHTML(code);
      } else if (responseType === "tokens") {
        const tokens = highlighter.getToken(code);
        response.tokens = request.options?.includeClasses
          ? highlighter.replaceByClasses(tokens)
          : tokens;
      } else {
        const result = highlighter.highlight(code);
        response.html = result.html;
        response.tokens = result.tokens;
        response.finalState = result.finalState;
      }

      this.send(ws, response);
    } catch {
      this.sendError(ws, request.id, "Highlight failed");
    }
  }

  private handleHighlightLine(ws: WebSocket, request: HighlightRequest): void {
    const languageDef = defaultRegistry.getLanguage(request.language as string);
    if (!languageDef) {
      this.sendError(ws, request.id, `Unsupported language: ${request.language}`);
      return;
    }

    try {
      const highlighter = this.createHighlighter(
        request.language as string,
        languageDef,
        request.options,
      );
      const line = request.code as string;
      const initialState = request.initialState?.length
        ? request.initialState
        : ["root"];
      const lineIndex = request.lineIndex ?? 0;
      const responseType = request.responseType ?? "html";
      const response: HighlightResponse = { id: request.id, success: true };

      if (responseType === "html") {
        const result = highlighter.getHTMLLine(line, initialState, lineIndex);
        response.html = result.html;
        response.finalState = result.finalState;
      } else if (responseType === "tokens") {
        const result = highlighter.getTokenLine(line, initialState, lineIndex);
        response.tokens = request.options?.includeClasses
          ? highlighter.replaceByClasses(result.tokens)
          : result.tokens;
        response.finalState = result.finalState;
      } else {
        const result = highlighter.highlightLine(line, initialState, lineIndex);
        response.html = result.html;
        response.tokens = result.tokens;
        response.finalState = result.finalState;
      }

      this.send(ws, response);
    } catch {
      this.sendError(ws, request.id, "Line highlight failed");
    }
  }

  private handleSupportedLanguages(ws: WebSocket, request: HighlightRequest): void {
    const response: SupportedLanguageResponse = {
      id: request.id,
      success: true,
      languages: Highlighter.getSupportedLanguages(),
    };
    this.send(ws, response);
  }

  private handleDetectLanguage(ws: WebSocket, request: HighlightRequest): void {
    const fileName =
      request.fileName ??
      (request.path ? request.path.split(/[\\/]/).pop() : undefined);
    const ext =
      request.ext && request.ext.length > 0
        ? request.ext
        : fileName && fileName.includes(".")
          ? `.${fileName.split(".").pop()}`.toLowerCase()
          : "";

    const response: DetectLanguageResponse = {
      id: request.id,
      success: true,
      language: Highlighter.detectLanguage(ext),
    };
    this.send(ws, response);
  }

  private handleOpenDocument(ws: WebSocket, request: HighlightRequest): void {
    const state = this.clients.get(ws);
    const language = request.language
      ? defaultRegistry.getLanguage(request.language)
      : undefined;
    if (!state || !request.documentId || !language || typeof request.code !== "string") {
      this.sendError(ws, request.id, "Invalid openDocument request");
      return;
    }
    if (
      this.maxDocumentCharacters > 0 &&
      request.code.length > this.maxDocumentCharacters
    ) {
      this.sendError(ws, request.id, "Document is too large");
      return;
    }

    const existing = state.documents.get(request.documentId);
    if (
      !existing &&
      this.maxDocumentsPerClient > 0 &&
      state.documents.size >= this.maxDocumentsPerClient
    ) {
      this.sendError(ws, request.id, "Too many open documents");
      return;
    }

    const nextCharacters =
      state.documentCharacters - (existing?.characters ?? 0) + request.code.length;
    if (
      this.maxClientDocumentCharacters > 0 &&
      nextCharacters > this.maxClientDocumentCharacters
    ) {
      this.sendError(ws, request.id, "Client document budget exceeded");
      return;
    }

    let document: IncrementalDocument;
    try {
      document = new IncrementalDocument(
        this.getOrCreateTokenizer(request.language as string, language),
        request.code,
      );
    } catch (error) {
      this.sendError(
        ws,
        request.id,
        isStateDepthError(error)
          ? "Document exceeds the configured lexical state depth"
          : "Document could not be tokenized",
      );
      return;
    }

    state.documents.set(request.documentId, {
      document,
      characters: request.code.length,
    });
    state.documentCharacters = nextCharacters;
    this.send(ws, { id: request.id, success: true });
  }

  private handleUpdateDocument(ws: WebSocket, request: HighlightRequest): void {
    const state = this.clients.get(ws);
    const entry = request.documentId
      ? state?.documents.get(request.documentId)
      : undefined;
    if (!state || !entry || !isDocumentUpdate(request)) {
      this.sendError(ws, request.id, "Invalid updateDocument request");
      return;
    }

    const document = entry.document;
    const oldLineCount = document.getLineCount();
    if (request.startLine + request.deletedLines > oldLineCount) {
      this.sendError(ws, request.id, "Invalid document update");
      return;
    }

    let removedCharacters = 0;
    for (let index = 0; index < request.deletedLines; index += 1) {
      removedCharacters += document.getLine(request.startLine + index).text.length;
    }
    const insertedCharacters = request.insertedLines.reduce(
      (total, line) => total + line.length,
      0,
    );
    const nextLineCount =
      oldLineCount - request.deletedLines + request.insertedLines.length;
    const nextCharacters =
      nextLineCount === 0
        ? 0
        : state.documentCharacters -
          removedCharacters -
          request.deletedLines +
          insertedCharacters +
          request.insertedLines.length;

    if (
      this.maxDocumentCharacters > 0 &&
      nextCharacters > this.maxDocumentCharacters
    ) {
      this.sendError(ws, request.id, "Document is too large");
      return;
    }
    if (
      this.maxClientDocumentCharacters > 0 &&
      nextCharacters > this.maxClientDocumentCharacters
    ) {
      this.sendError(ws, request.id, "Client document budget exceeded");
      return;
    }

    try {
      const update = document.updateLines(
        request.startLine,
        request.deletedLines,
        request.insertedLines,
      );
      entry.characters = nextCharacters;
      state.documentCharacters = nextCharacters;

      const changedLength = update.changedEndLine - update.changedStartLine;
      const truncated =
        this.maxLinesPerRequest > 0 && changedLength > this.maxLinesPerRequest;
      const endLine = truncated
        ? update.changedStartLine + this.maxLinesPerRequest
        : update.changedEndLine;
      const response: HighlightResponse = {
        id: request.id,
        success: true,
        changedStartLine: update.changedStartLine,
        changedEndLine: update.changedEndLine,
        lines: document.getLines(update.changedStartLine, endLine),
      };
      if (truncated) {
        response.linesTruncated = true;
      }
      this.send(ws, response);
    } catch (error) {
      this.sendError(
        ws,
        request.id,
        isStateDepthError(error)
          ? "Document exceeds the configured lexical state depth"
          : "Invalid document update",
      );
    }
  }

  private handleCloseDocument(ws: WebSocket, request: HighlightRequest): void {
    const state = this.clients.get(ws);
    const entry = request.documentId
      ? state?.documents.get(request.documentId)
      : undefined;
    if (!state || !entry || !request.documentId) {
      this.sendError(ws, request.id, "Unknown document");
      return;
    }
    state.documents.delete(request.documentId);
    state.documentCharacters -= entry.characters;
    this.send(ws, { id: request.id, success: true });
  }

  private handleGetDocumentLines(ws: WebSocket, request: HighlightRequest): void {
    const state = this.clients.get(ws);
    const entry = request.documentId
      ? state?.documents.get(request.documentId)
      : undefined;
    const startLine = request.startLine;
    const endLine = request.endLine;
    if (
      !entry ||
      !Number.isSafeInteger(startLine) ||
      !Number.isSafeInteger(endLine)
    ) {
      this.sendError(ws, request.id, "Invalid getDocumentLines request");
      return;
    }
    try {
      this.send(ws, {
        id: request.id,
        success: true,
        lines: entry.document.getLines(startLine, endLine),
      });
    } catch {
      this.sendError(ws, request.id, "Invalid line range");
    }
  }

  private createHighlighter(
    languageName: string,
    language: import("../types/language").LanguageDefinition,
    options?: import("../types/highlighter").HighlightOptions,
  ): Highlighter {
    return new Highlighter(
      language,
      options,
      this.getOrCreateTokenizer(languageName, language),
    );
  }

  private getOrCreateTokenizer(
    languageName: string,
    language: import("../types/language").LanguageDefinition,
  ): Tokenizer {
    const key = languageName.toLowerCase();
    let tokenizer = this.tokenizers.get(key);
    if (!tokenizer) {
      tokenizer = new Tokenizer(language, { maxStateDepth: this.maxStateDepth });
      this.tokenizers.set(key, tokenizer);
    }
    return tokenizer;
  }

  private send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private sendError(ws: WebSocket, id: string | undefined, error: string): void {
    const payload: Record<string, unknown> = { success: false, error };
    if (id !== undefined) {
      payload.id = id;
    }
    this.send(ws, payload);
  }
}

function getRequestId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const id = (value as { id?: unknown }).id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number" || typeof id === "boolean") return String(id);
  return undefined;
}

function rawDataToString(message: RawData): string {
  if (Buffer.isBuffer(message)) return message.toString();
  if (Array.isArray(message)) return Buffer.concat(message).toString();
  return Buffer.from(message).toString();
}

const REQUEST_TYPES = new Set([
  "highlight",
  "highlightLine",
  "supportedLanguages",
  "detectLanguage",
  "openDocument",
  "updateDocument",
  "closeDocument",
  "getDocumentLines",
]);

const RESPONSE_TYPES = new Set(["html", "tokens", "both"]);

function validateRequest(value: unknown, limits: ServerValidationLimits): string {
  if (!value || typeof value !== "object") return "Request must be a JSON object";
  const request = value as Record<string, unknown>;
  if (typeof request.requestType !== "string" || !REQUEST_TYPES.has(request.requestType)) {
    return "Request not valid: unknown or missing requestType";
  }
  if (typeof request.id !== "string" || request.id.length === 0) {
    return "Request not valid: id must be a non-empty string";
  }

  switch (request.requestType) {
    case "highlight":
      return validateHighlight(request, limits);
    case "highlightLine":
      return validateHighlightLine(request, limits);
    case "supportedLanguages":
      return validateResponseType(request);
    case "detectLanguage":
      return validateDetectLanguage(request);
    case "openDocument":
      return validateOpenDocument(request, limits);
    case "updateDocument":
      return validateUpdateDocumentRequest(request, limits);
    case "closeDocument":
      return validateDocumentId(request);
    case "getDocumentLines":
      return validateGetDocumentLines(request, limits);
    default:
      return "Request not valid: unknown or missing requestType";
  }
}

function validateResponseType(request: Record<string, unknown>): string {
  if (
    request.responseType !== undefined &&
    (typeof request.responseType !== "string" || !RESPONSE_TYPES.has(request.responseType))
  ) {
    return "Request not valid: invalid responseType";
  }
  return "";
}

function validateHighlight(
  request: Record<string, unknown>,
  limits: ServerValidationLimits,
): string {
  const base = validateResponseType(request);
  if (base) return base;
  if (typeof request.language !== "string" || request.language.length === 0) {
    return "Request not valid: language must be a non-empty string";
  }
  if (typeof request.code !== "string") return "Request not valid: code must be a string";
  if (
    limits.maxDocumentCharacters > 0 &&
    request.code.length > limits.maxDocumentCharacters
  ) {
    return "Request not valid: code is too large";
  }
  return "";
}

function validateHighlightLine(
  request: Record<string, unknown>,
  limits: ServerValidationLimits,
): string {
  const base = validateHighlight(request, limits);
  if (base) return base;
  if (
    request.lineIndex !== undefined &&
    (typeof request.lineIndex !== "number" ||
      !Number.isSafeInteger(request.lineIndex) ||
      request.lineIndex < 0)
  ) {
    return "Request not valid: lineIndex must be an integer >= 0";
  }
  if (request.initialState !== undefined) {
    if (
      !Array.isArray(request.initialState) ||
      request.initialState.length > limits.maxStateDepth ||
      !request.initialState.every(
        (state) =>
          typeof state === "string" &&
          state.length > 0 &&
          state.length <= 256,
      )
    ) {
      return "Request not valid: initialState is invalid";
    }
  }
  return "";
}

function validateDetectLanguage(request: Record<string, unknown>): string {
  const base = validateResponseType(request);
  if (base) return base;
  for (const field of ["ext", "path", "fileName"] as const) {
    if (request[field] !== undefined && typeof request[field] !== "string") {
      return `Request not valid: ${field} must be a string`;
    }
  }
  const found = [request.ext, request.path, request.fileName].some(
    (value) => typeof value === "string" && value.length > 0,
  );
  return found ? "" : "Request not valid: ext, path or fileName required";
}

function validateDocumentId(request: Record<string, unknown>): string {
  return typeof request.documentId === "string" && request.documentId.length > 0
    ? ""
    : "Request not valid: documentId must be a non-empty string";
}

function validateOpenDocument(
  request: Record<string, unknown>,
  limits: ServerValidationLimits,
): string {
  const documentIdError = validateDocumentId(request);
  if (documentIdError) return documentIdError;
  if (typeof request.language !== "string" || request.language.length === 0) {
    return "Request not valid: language must be a non-empty string";
  }
  if (typeof request.code !== "string") return "Request not valid: code must be a string";
  if (
    limits.maxDocumentCharacters > 0 &&
    request.code.length > limits.maxDocumentCharacters
  ) {
    return "Request not valid: document is too large";
  }
  return "";
}

function validateUpdateDocumentRequest(
  request: Record<string, unknown>,
  limits: ServerValidationLimits,
): string {
  const documentIdError = validateDocumentId(request);
  if (documentIdError) return documentIdError;
  if (
    typeof request.startLine !== "number" ||
    !Number.isSafeInteger(request.startLine) ||
    request.startLine < 0
  ) {
    return "Request not valid: startLine must be an integer >= 0";
  }
  if (
    typeof request.deletedLines !== "number" ||
    !Number.isSafeInteger(request.deletedLines) ||
    request.deletedLines < 0
  ) {
    return "Request not valid: deletedLines must be an integer >= 0";
  }
  if (!Array.isArray(request.insertedLines)) {
    return "Request not valid: insertedLines must be an array of strings";
  }
  if (
    limits.maxLinesPerRequest > 0 &&
    request.insertedLines.length > limits.maxLinesPerRequest
  ) {
    return "Request not valid: too many inserted lines";
  }
  if (
    !request.insertedLines.every(
      (line) => typeof line === "string" && !line.includes("\n"),
    )
  ) {
    return "Request not valid: insertedLines must contain single-line strings";
  }
  return "";
}

function validateGetDocumentLines(
  request: Record<string, unknown>,
  limits: ServerValidationLimits,
): string {
  const documentIdError = validateDocumentId(request);
  if (documentIdError) return documentIdError;
  if (
    typeof request.startLine !== "number" ||
    !Number.isSafeInteger(request.startLine) ||
    request.startLine < 0 ||
    typeof request.endLine !== "number" ||
    !Number.isSafeInteger(request.endLine) ||
    request.endLine < request.startLine
  ) {
    return "Request not valid: invalid line range";
  }
  if (
    limits.maxLinesPerRequest > 0 &&
    request.endLine - request.startLine > limits.maxLinesPerRequest
  ) {
    return "Request not valid: line range is too large";
  }
  return "";
}

function isDocumentUpdate(
  request: HighlightRequest,
): request is HighlightRequest & {
  documentId: string;
  startLine: number;
  deletedLines: number;
  insertedLines: string[];
} {
  return (
    typeof request.documentId === "string" &&
    request.documentId.length > 0 &&
    typeof request.startLine === "number" &&
    Number.isSafeInteger(request.startLine) &&
    request.startLine >= 0 &&
    typeof request.deletedLines === "number" &&
    Number.isSafeInteger(request.deletedLines) &&
    request.deletedLines >= 0 &&
    Array.isArray(request.insertedLines) &&
    request.insertedLines.every((line) => typeof line === "string")
  );
}

function isStateDepthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /state stack|maxStateDepth|state depth/i.test(error.message)
  );
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}

function requireNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return value;
}

function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return origin.trim().toLowerCase().replace(/\/$/, "");
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_ORIGIN_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}
