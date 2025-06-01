// netlify/functions/groq-proxy.js
import fetch from 'node-fetch';

// Liste aqui suas chaves Groq (serão usadas servidor‐side apenas)
const API_KEYS = [
  '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',
  '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',
  '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',
  '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'
];

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  if (!Array.isArray(payload.promptMessages)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltou promptMessages (array)' }) };
  }

  const bodyTemplate = {
    model: 'llama-3.3-70b-versatile',
    messages: payload.promptMessages,
    max_tokens: payload.max_tokens || 512,
    temperature: payload.temperature || 0.2
  };

  let lastError = null;

  for (const key of API_KEYS) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(bodyTemplate)
      });

      if (resp.status === 429) {
        lastError = new Error(`Rate limit (429) com chave ${key}`);
        continue;
      }
      const text = await resp.text();
      if (resp.ok) {
        return {
          statusCode: 200,
          body: text
        };
      } else {
        lastError = new Error(`Groq retornou ${resp.status}: ${text}`);
        continue;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  return {
    statusCode: 502,
    body: JSON.stringify({ error: lastError.message })
  };
}
