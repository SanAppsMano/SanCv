// netlify/functions/sheet-insert.js
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Carrega credenciais da Service Account.
// Em produção, preferível usar VARs de ambiente em vez de arquivo em disco.
const CREDENTIALS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../service-account.json'), 'utf8')
);

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  if (!Array.isArray(body.rows)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta rows (array)' }) };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: CREDENTIALS,
    scopes: SCOPES
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = '1t3zpEeD5nVyLKgbfZf5jXOZPN2zYWt7Xmy_k817p440';
  const sheetName     = 'cadcv';

  try {
    // (A) Garante cabeçalhos na 1ª linha
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`
    });
    const existingHeaders = getRes.data.values ? getRes.data.values[0] : [];
    const needed = ['Nome Completo','Experiência','Habilidades','Educação','Idiomas','Contato'];
    let headers = existingHeaders.slice();
    let updated = false;
    needed.forEach(col => {
      if (!headers.includes(col)) {
        headers.push(col);
        updated = true;
      }
    });
    if (updated) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });
    }

    // (B) Append das linhas
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
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
