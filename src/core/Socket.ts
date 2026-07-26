import { WebSocketServer, WebSocket } from 'ws';

import { Highlighter } from './Highlighter';
import { LanguageDefinition } from '../types/language';
import { HighlightOptions } from '../types/highlighter';
import { JavaScript } from '../languages/JavaScript';
import { TypeScript } from '../languages/TypeScript';
import { Python } from '../languages/Python';
import { HTML } from '../languages/HTML';
import { CSS } from '../languages/CSS';

interface HighlightRequest {
  id: string;
  code: string;
  language: string;
  options?: HighlightOptions;
}

interface HighlightResponse {
  id: string;
  success: boolean;
  html?: string;
  error?: string;
}

const languages: Record<string, LanguageDefinition> = {
  javascript: new JavaScript(),
  typescript: new TypeScript(),
  python: new Python(),
  html: new HTML(),
  css: new CSS()
};

const wss = new WebSocketServer({ port: 8080 });

console.log('NSH Socket Server démarré sur ws://localhost:8080');

wss.on('connection', (ws: WebSocket) => {
  console.log('Nouveau client connecté');

  ws.on('message', (message: string) => {
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
      const result = highlighter.highlight(request.code);

      const response: HighlightResponse = {
        id: request.id,
        success: true,
        html: result.html
      };

      ws.send(JSON.stringify(response));

    } catch (error: any) {
      const errorResponse: HighlightResponse = {
        id: request.id,
        success: false,
        error: error.message || 'Erreur inconnue lors du highlight'
      };
      ws.send(JSON.stringify(errorResponse));
    }
  });

  ws.on('close', () => {
    console.log('Client déconnecté');
  });
});