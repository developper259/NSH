import { WebSocketServer, WebSocket } from "ws";

import { Highlighter } from "./Highlighter";
import { Tokenizer } from "./Tokenizer";
import { IncrementalDocument } from "./IncrementalDocument";
import { defaultRegistry } from "../languages/Languages";
import { DetectLanguageResponse, HighlightRequest, HighlightResponse, SupportedLanguageResponse, NSHServerOptions } from "../types/socket";

export class NSHServer {
  private readonly configuredPort: number;
  private port: number;
  private host: string;
  private maxPayload: number;
  private wss: WebSocketServer | null = null;
  private listening = false;
  private startPromise: Promise<number> | null = null;
  private stopPromise: Promise<void> | null = null;
  private readonly tokenizers = new Map<string, Tokenizer>();
  private readonly documents = new Map<WebSocket, Map<string, IncrementalDocument>>();

  constructor(options: number | NSHServerOptions = 0) {
    const config = typeof options === "number" ? { port: options } : options;
    this.configuredPort = config.port ?? 0;
    this.port = this.configuredPort;
    this.host = config.host ?? "127.0.0.1";
    this.maxPayload = config.maxPayload ?? 2 * 1024 * 1024;
  }

  public async start(): Promise<number> {
    if (this.stopPromise) {
      await this.stopPromise;
      this.stopPromise = null;
    }

    if (this.wss && this.startPromise) {
      return this.startPromise;
    }
    if (this.wss) {
      return this.port;
    }

    const server = new WebSocketServer({
      host: this.host,
      port: this.configuredPort,
      maxPayload: this.maxPayload,
    });
    this.wss = server;

    server.on("connection", (ws: WebSocket) => this.handleConnection(ws));
    this.startPromise = new Promise<number>((resolve, reject) => {
      const cleanup = (): void => {
        server.removeListener("listening", onListening);
        server.removeListener("error", onError);
      };
      const onListening = (): void => {
        const address = server.address();
        if (!address || typeof address === "string") {
          cleanup();
          this.wss = null;
          this.listening = false;
          this.startPromise = null;
          reject(new Error("NSH server did not expose a TCP port"));
          return;
        }

        this.port = address.port;
        cleanup();
        this.listening = true;
        resolve(this.port);
      };
      const onError = (error: Error): void => {
        cleanup();
        this.wss = null;
        this.listening = false;
        this.startPromise = null;
        reject(error);
      };

      server.once("listening", onListening);
      server.once("error", onError);
    });

    return this.startPromise;
  }

  public getPort(): number | null {
    return this.wss && this.listening ? this.port : null;
  }

  public documentsSize(): number {
    return this.documents.size;
  }

  public stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }
    if (!this.wss) {
      this.port = this.configuredPort;
      return Promise.resolve();
    }

    const server = this.wss;
    this.stopPromise = new Promise<void>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const done = (): void => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        this.wss = null;
        this.listening = false;
        this.startPromise = null;
        this.port = this.configuredPort;
        this.stopPromise = null;
        resolve();
      };

      for (const client of server.clients) {
        client.close();
      }

      timeout = setTimeout(() => {
        for (const client of server.clients) {
          client.terminate();
        }
        done();
      }, 500);

      server.close(() => done());
    });
    return this.stopPromise;
  }

  private handleConnection(ws: WebSocket): void {
    this.documents.set(ws, new Map());
    ws.on("message", (message: string) => this.handleMessage(ws, message));
    ws.on("error", () => undefined);
    ws.on("close", () => this.documents.delete(ws));
  }

  private handleMessage(ws: WebSocket, message: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(message.toString());
    } catch {
      ws.send(JSON.stringify({ success: false, error: "Format JSON invalide" }));
      return;
    }

    const id = getRequestId(parsed);
    const validationError = validateRequest(parsed);
    if (validationError) {
      this.sendError(ws, id, validationError);
      return;
    }

    const request = parsed as HighlightRequest;
    {
      if (request.requestType === "highlight") {
        this.handleHighlight(ws, request);
      } else if (request.requestType === "highlightLine") {
        this.handleHighlightLine(ws, request);
      } else if (request.requestType === "supportedLanguages") {
        this.handleSupportedLanguage(ws, request);
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
      } else {
        this.sendError(ws, request.id, `requestType inconnu : ${request.requestType}`);
      }
    }
  }

  private handleHighlight(ws: WebSocket, request: HighlightRequest): void {
    try {
      if (!request.language || request.code === undefined || request.code === null) {
        throw new Error('Request not valid : language or code missing !');
      }

      const language: string = request.language || "";
      const code: string = request.code;

      const languageDef = defaultRegistry.getLanguage(language);

      if (!languageDef) {
        throw new Error(`Langage non supporté : ${language}`);
      }

      const highlighter = this.createHighlighter(language, languageDef, request.options);

      const responseType = request.responseType || "html";
      const response: HighlightResponse = {
        id: request.id,
        success: true,
      };

      if (responseType === "html") {
        response.html = highlighter.getHTML(code);
      }

      if (responseType === "tokens") {
        response.tokens = highlighter.getToken(code);

        if (request.options?.includeClasses) {
          response.tokens = highlighter.replaceByClasses(response.tokens);
        }
      }

      if (responseType === "both") {
        const result = highlighter.highlight(code);
        response.html = result.html;
        response.tokens = result.tokens;
        response.finalState = result.finalState;
      }

      ws.send(JSON.stringify(response));
    } catch (error: any) {
      const errorResponse: HighlightResponse = {
        id: request.id,
        success: false,
        error: error.message || "Erreur inconnue lors du highlight",
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  private handleHighlightLine(ws: WebSocket, request: HighlightRequest): void {
    try {
      if (!request.language || request.code === undefined || request.code === null) {
        throw new Error('Request not valid : language or code missing !');
      }

      const language: string = request.language;
      const line: string = request.code;

      const languageDef = defaultRegistry.getLanguage(language);

      if (!languageDef) {
        throw new Error(`Langage non supporté : ${language}`);
      }

      const highlighter = this.createHighlighter(language, languageDef, request.options);

      const initialState =
        request.initialState && request.initialState.length > 0
          ? request.initialState
          : ["root"];
      const lineIndex = request.lineIndex ?? 0;

      const responseType = request.responseType || "html";
      const response: HighlightResponse = {
        id: request.id,
        success: true,
      };

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

      ws.send(JSON.stringify(response));
    } catch (error: any) {
      const errorResponse: HighlightResponse = {
        id: request.id,
        success: false,
        error: error.message || "Erreur inconnue lors du highlight de ligne",
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  private handleSupportedLanguage(ws: WebSocket, request: HighlightRequest): void {
    try {
      const response: SupportedLanguageResponse = {
        id: request.id,
        success: true,
        languages: Highlighter.getSupportedLanguages(),
      };
      ws.send(JSON.stringify(response));
    } catch (error: any) {
      const errorResponse: SupportedLanguageResponse = {
        id: request.id,
        success: false,
        error: error.message || "Erreur inconnue lors de la récupération des langages supportés",
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  private handleDetectLanguage(ws: WebSocket, request: HighlightRequest): void {
    try {
      if (!request.ext && !request.path && !request.fileName) {
        throw new Error('Request not valid : ext, path or fileName missing !');
      }

      let ext: string = request.ext || "";
      if (!ext) {
        const fileName = request.path ? request.path.split('/').pop() : request.fileName;

        if (fileName && fileName.includes('.')) {
          const parts = fileName.split('.');
          ext = `.${parts.pop()}`.toLowerCase();
        }
      }

      const language = Highlighter.detectLanguage(ext);

      const response: DetectLanguageResponse = {
        id: request.id,
        success: true,
        language: language,
      };
      ws.send(JSON.stringify(response));
    } catch (error: any) {
      const errorResponse: DetectLanguageResponse = {
        id: request.id,
        success: false,
        error: error.message || "Erreur inconnue lors de la détection du langage",
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  private createHighlighter(languageName: string, language: import("../types/language").LanguageDefinition, options?: import("../types/highlighter").HighlightOptions): Highlighter {
    return new Highlighter(language, options, this.getOrCreateTokenizer(languageName, language));
  }

  private getOrCreateTokenizer(languageName: string, language: import("../types/language").LanguageDefinition): Tokenizer {
    const key = languageName.toLowerCase();
    let tokenizer = this.tokenizers.get(key);
    if (!tokenizer) {
      tokenizer = new Tokenizer(language);
      this.tokenizers.set(key, tokenizer);
    }
    return tokenizer;
  }

  private handleOpenDocument(ws: WebSocket, request: HighlightRequest): void {
    const session = this.documents.get(ws);
    const language = request.language ? defaultRegistry.getLanguage(request.language) : undefined;
    if (!session || !request.documentId || !language || typeof request.code !== "string") {
      this.sendError(ws, request.id, "Invalid openDocument request");
      return;
    }
    session.set(request.documentId, new IncrementalDocument(this.getOrCreateTokenizer(request.language as string, language), request.code));
    ws.send(JSON.stringify({ id: request.id, success: true }));
  }

  private handleUpdateDocument(ws: WebSocket, request: HighlightRequest): void {
    const document = request.documentId ? this.documents.get(ws)?.get(request.documentId) : undefined;
    if (!document || !isValidDocumentUpdate(request)) {
      this.sendError(ws, request.id, "Invalid updateDocument request");
      return;
    }
    const update = document.updateLines(request.startLine, request.deletedLines, request.insertedLines);
    ws.send(JSON.stringify({
      id: request.id,
      success: true,
      changedStartLine: update.changedStartLine,
      changedEndLine: update.changedEndLine,
      lines: document.getLines(update.changedStartLine, update.changedEndLine),
    }));
  }

  private handleCloseDocument(ws: WebSocket, request: HighlightRequest): void {
    if (!request.documentId || !this.documents.get(ws)?.delete(request.documentId)) {
      this.sendError(ws, request.id, "Unknown document");
      return;
    }
    ws.send(JSON.stringify({ id: request.id, success: true }));
  }

  private handleGetDocumentLines(ws: WebSocket, request: HighlightRequest): void {
    const document = request.documentId ? this.documents.get(ws)?.get(request.documentId) : undefined;
    if (!document || !Number.isInteger(request.startLine) || !Number.isInteger(request.endLine)) {
      this.sendError(ws, request.id, "Invalid getDocumentLines request");
      return;
    }
    try {
      ws.send(JSON.stringify({ id: request.id, success: true, lines: document.getLines(request.startLine, request.endLine) }));
    } catch (error) {
      this.sendError(ws, request.id, error instanceof Error ? error.message : "Invalid line range");
    }
  }

  private sendError(ws: WebSocket, id: string | undefined, error: string): void {
    const payload: Record<string, unknown> = { success: false, error };
    if (id !== undefined) {
      payload.id = id;
    }
    ws.send(JSON.stringify(payload));
  }
}

function getRequestId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
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

function validateRequest(value: unknown): string {
  if (!value || typeof value !== "object") return "Request must be a JSON object";
  const request = value as Record<string, unknown>;
  if (typeof request.requestType !== "string" || !REQUEST_TYPES.has(request.requestType)) {
    return "Request not valid: unknown or missing requestType";
  }

  switch (request.requestType) {
    case "highlight":
      return validateHighlight(request);
    case "highlightLine":
      return validateHighlightLine(request);
    case "supportedLanguages":
      return "";
    case "detectLanguage":
      return validateDetectLanguage(request);
    case "openDocument":
      return validateOpenDocument(request);
    case "updateDocument":
      return validateUpdateDocumentRequest(request);
    case "closeDocument":
    case "getDocumentLines":
      return typeof request.documentId === "string" && request.documentId.length > 0
        ? ""
        : "Request not valid: documentId must be a non-empty string";
    default:
      return `requestType inconnu : ${String(request.requestType)}`;
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

function validateIdAndBase(request: Record<string, unknown>): string {
  if (typeof request.id !== "string" || request.id.length === 0) {
    return "Request not valid: id must be a non-empty string";
  }
  return validateResponseType(request);
}

function validateHighlight(request: Record<string, unknown>): string {
  const base = validateIdAndBase(request);
  if (base) return base;
  if (typeof request.language !== "string" || request.language.length === 0) {
    return "Request not valid: language must be a non-empty string";
  }
  if (typeof request.code !== "string") return "Request not valid: code must be a string";
  return "";
}

function validateHighlightLine(request: Record<string, unknown>): string {
  const base = validateHighlight(request);
  if (base) return base;
  if (
    request.lineIndex !== undefined &&
    (typeof request.lineIndex !== "number" || !Number.isInteger(request.lineIndex) || request.lineIndex < 0)
  ) {
    return "Request not valid: lineIndex must be an integer >= 0";
  }
  if (
    request.initialState !== undefined &&
    (!Array.isArray(request.initialState) || !request.initialState.every((state) => typeof state === "string"))
  ) {
    return "Request not valid: initialState must be an array of strings";
  }
  return "";
}

function validateDetectLanguage(request: Record<string, unknown>): string {
  const found = [request.ext, request.path, request.fileName].some((value) => typeof value === "string" && value.length > 0);
  return found ? "" : "Request not valid: ext, path or fileName required";
}

function validateOpenDocument(request: Record<string, unknown>): string {
  const base = validateIdAndBase(request);
  if (base) return base;
  if (typeof request.documentId !== "string" || request.documentId.length === 0) {
    return "Request not valid: documentId must be a non-empty string";
  }
  if (typeof request.language !== "string" || request.language.length === 0) {
    return "Request not valid: language must be a non-empty string";
  }
  if (typeof request.code !== "string") return "Request not valid: code must be a string";
  return "";
}

function validateUpdateDocumentRequest(request: Record<string, unknown>): string {
  const base = validateIdAndBase(request);
  if (base) return base;
  if (typeof request.documentId !== "string" || request.documentId.length === 0) {
    return "Request not valid: documentId must be a non-empty string";
  }
  if (typeof request.startLine !== "number" || !Number.isInteger(request.startLine) || request.startLine < 0) {
    return "Request not valid: startLine must be an integer >= 0";
  }
  if (typeof request.deletedLines !== "number" || !Number.isInteger(request.deletedLines) || request.deletedLines < 0) {
    return "Request not valid: deletedLines must be an integer >= 0";
  }
  if (!Array.isArray(request.insertedLines) || !request.insertedLines.every((line) => typeof line === "string")) {
    return "Request not valid: insertedLines must be an array of strings";
  }
  return "";
}

function isValidRequest(value: unknown): value is HighlightRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.id === "string" &&
    request.id.length > 0 &&
    typeof request.requestType === "string" &&
    REQUEST_TYPES.has(request.requestType) &&
    validateRequest(request) === ""
  );
}

function isValidDocumentUpdate(request: Partial<HighlightRequest>): request is HighlightRequest & { documentId: string; startLine: number; deletedLines: number; insertedLines: string[] } {
  const startLine = request.startLine;
  const deletedLines = request.deletedLines;
  const insertedLines = request.insertedLines;
  return typeof request.documentId === "string" && request.documentId.length > 0 && typeof startLine === "number" && Number.isInteger(startLine) && startLine >= 0 &&
    typeof deletedLines === "number" && Number.isInteger(deletedLines) && deletedLines >= 0 && Array.isArray(insertedLines) &&
    insertedLines.every((line) => typeof line === "string");
}
