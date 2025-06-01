// netlify/functions/sheet-insert.js

import { google } from 'googleapis';

/**
 * Agora, em vez de ler um arquivo físico, pegamos o JSON da Service Account
 * diretamente da variável de ambiente GOOGLE_SERVICE_ACCOUNT.
 */
const CREDENTIALS = process.env.GOOGLE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)
  : null;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Substitua estes valores pelo seu ID de planilha e nome da aba
const SPREADSHEET_ID = '1t3zpEeD5nVyLKgbfZf5jXOZPN2zYWt7Xmy_k817p440';
const SHEET_NAME     = 'cadcv';

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido. Use POST.' })
    };
  }

  // Verifica se a variável de ambiente existe
  if (!CREDENTIALS) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Variável de ambiente GOOGLE_SERVICE_ACCOUNT não definida ou inválida.'
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'JSON inválido no body.' })
    };
  }

  if (!Array.isArray(body.rows)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Faltou “rows” (array) no JSON.' })
    };
  }

  try {
    // Autentica usando a Service Account (via variável de ambiente)
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: SCOPES
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // (A) Garante que a primeira linha contenha os cabeçalhos
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`
    });
    const existingHeaders = getRes.data.values ? getRes.data.values[0] : [];
    const needed = ['Nome Completo','Experiência','Habilidades','Educação','Idiomas'];
    const headers = existingHeaders.slice();
    let updated = false;

    needed.forEach(col => {
      if (!headers.includes(col)) {
        headers.push(col);
        updated = true;
      }
    });

    if (updated) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!1:1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });
    }

    // (B) Faz append das linhas recebidas no body.rows
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: body.rows }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', appended: body.rows.length })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', error: err.message })
    };
  }
}
