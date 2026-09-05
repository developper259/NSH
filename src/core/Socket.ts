import { WebSocketServer, WebSocket } from "ws";

import { Highlighter } from "./Highlighter";
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
      server.close(() => {
        this.wss = null;
        this.listening = false;
        this.startPromise = null;
        this.port = this.configuredPort;
        this.stopPromise = null;
        resolve();
      });
    });
    return this.stopPromise;
  }

  private handleConnection(ws: WebSocket): void {
    ws.on("message", (message: string) => this.handleMessage(ws, message));
    ws.on("error", () => undefined);
  }

  private handleMessage(ws: WebSocket, message: string): void {
    let request: HighlightRequest;

    try {
      request = JSON.parse(message.toString());

      if (!isValidRequest(request)) {
        ws.send(
          JSON.stringify({
            success: false,
            error: "Request not valid",
          }),
        );
        return;
      }

      if (request.requestType === "highlight") {
        this.handleHighlight(ws, request);
      } else if (request.requestType === "highlightLine") {
        this.handleHighlightLine(ws, request);
      } else if (request.requestType === "supportedLanguages") {
        this.handleSupportedLanguage(ws, request);
      } else if (request.requestType === "detectLanguage") {
        this.handleDetectLanguage(ws, request);
      } else {
        ws.send(
          JSON.stringify({
            id: request.id,
            success: false,
            error: `requestType inconnu : ${request.requestType}`,
          }),
        );
      }
    } catch (e) {
      ws.send(
        JSON.stringify({ success: false, error: "Format JSON invalide" }),
      );
      return;
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

      const highlighter = new Highlighter(languageDef, request.options);

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

      const highlighter = new Highlighter(languageDef, request.options);

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
}

function isValidRequest(value: unknown): value is HighlightRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<HighlightRequest>;
  const requestTypes = ["highlight", "highlightLine", "supportedLanguages", "detectLanguage"];
  const responseTypes = ["html", "tokens", "both"];
  return typeof request.id === "string" && request.id.length > 0 &&
    typeof request.requestType === "string" && requestTypes.includes(request.requestType) &&
    (request.responseType === undefined || responseTypes.includes(request.responseType));
}