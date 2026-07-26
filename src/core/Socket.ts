import { WebSocketServer, WebSocket } from 'ws';

import { Highlighter } from './Highlighter';
import { LanguageDefinition } from '../types/language';
import { HighlightOptions } from '../types/highlighter';
import { JavaScript } from '../languages/JavaScript';
import { TypeScript } from '../languages/TypeScript';
import { Python } from '../languages/Python';
import { HTML } from '../languages/HTML';
import { CSS } from '../languages/CSS';

// 1. Définition des interfaces pour le typage strict des messages
interface HighlightRequest {
  id: string; // Pour lier la réponse à la demande
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

// 2. Initialisation du registre de langages
const languages: Record<string, LanguageDefinition> = {
  javascript: new JavaScript(),
  typescript: new TypeScript(),
  python: new Python(),
  html: new HTML(),
  css: new CSS()
};

// 3. Configuration du serveur WebSocket sur le port 8080
const wss = new WebSocketServer({ port: 8080 });

console.log('NSH Socket Server démarré sur ws://localhost:8080');

wss.on('connection', (ws: WebSocket) => {
  console.log('Nouveau client connecté');

  ws.on('message', (message: string) => {
    let request: HighlightRequest;

    // Étape A : Décoder la requête
    try {
      request = JSON.parse(message.toString());
    } catch (e) {
      ws.send(JSON.stringify({ success: false, error: 'Format JSON invalide' }));
      return;
    }

    // Étape B : Traiter la colorisation
    try {
      const languageDef = languages[request.language.toLowerCase()];
      
      if (!languageDef) {
        throw new Error(`Langage non supporté : ${request.language}`);
      }

      // Utilise votre classe Highlighter exacte
      const highlighter = new Highlighter(languageDef, request.options);
      const result = highlighter.highlight(request.code);

      // Étape C : Préparer la réponse
      const response: HighlightResponse = {
        id: request.id,
        success: true,
        html: result.html
      };

      ws.send(JSON.stringify(response));

    } catch (error: any) {
      // En cas d'erreur (ex: erreur de parsing), on informe le client
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