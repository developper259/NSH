import { WebSocketServer, WebSocket } from 'ws';

import { Highlighter } from './Highlighter';
import { languages } from '../languages/Languages'; 
import { HighlightRequest, HighlightResponse } from '../types/socket';

export class NSHServer {
  private port: number;
  private wss: WebSocketServer | null = null;

  constructor(port: number = 8080) {
    this.port = port;
  }

  public start(): void {
    if (this.wss) {
      console.warn(`Le serveur NSH est déjà en cours d'exécution sur le port ${this.port}`);
      return;
    }

    this.wss = new WebSocketServer({ port: this.port });
    console.log(`NSH Socket Server démarré sur ws://localhost:${this.port}`);

    this.wss.on('connection', (ws: WebSocket) => this.handleConnection(ws));
  }

  public stop(): void {
    if (this.wss) {
      this.wss.close(() => {
        console.log('NSH Socket Server arrêté.');
      });
      this.wss = null;
    }
  }

  private handleConnection(ws: WebSocket): void {
    console.log('Nouveau client connecté');
    ws.on('message', (message: string) => this.handleMessage(ws, message));
    ws.on('close', () => console.log('Client déconnecté'));
  }

  private handleMessage(ws: WebSocket, message: string): void {
    let request: HighlightRequest;

    try {
      request = JSON.parse(message.toString());
    } catch (e) {
      ws.send(JSON.stringify({ success: false, error: 'Format JSON invalide' }));
      return;
    }

    try {
      const languageDef = languages[request.language.toLowerCase()];
      
      if (!languageDef) {
        throw new Error(`Langage non supporté : ${request.language}`);
      }

      const highlighter = new Highlighter(languageDef, request.options);
      
      const responseType = request.responseType || 'html';
      const response: HighlightResponse = {
        id: request.id,
        success: true
      };

      if (responseType === 'html') {
        response.html = highlighter.getHTML(request.code);
      }

      if (responseType === 'tokens') {
        response.tokens = highlighter.getToken(request.code);

        if (request.options?.includeClasses) {
          response.tokens = highlighter.replaceByClasses(response.tokens);
        }
      }

      if (responseType === 'both') {
        const result = highlighter.highlight(request.code);
        response.html = result.html;
        response.tokens = result.tokens;
      }

      ws.send(JSON.stringify(response));

    } catch (error: any) {
      const errorResponse: HighlightResponse = {
        id: request.id,
        success: false,
        error: error.message || 'Erreur inconnue lors du highlight'
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }
}