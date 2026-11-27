import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MODEL_NAME = 'gemini-3.8-flash';

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Checks whether an error is a Gemini quota (429 / RESOURCE_EXHAUSTED)
 * or temporary unavailability (503 / UNAVAILABLE) error.
 *
 * @param {any} err
 * @returns {boolean}
 */
export function isQuotaOrUnavailableError(err) {
  if (!err) return false;
  const status = err.status || err.code;
  if (status === 429 || status === 503) return true;

  const msg = String(err.message || err).toUpperCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('QUOTA')
  );
}

/**
 * Retries a Gemini call up to `maxRetries` (default 2) on 503 / UNAVAILABLE errors.
 */
async function callWithRetry(fn, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || err).toUpperCase();
      const isUnavailable = err?.status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE');

      if (isUnavailable && attempt < maxRetries) {
        console.warn(
          `⚠️ Gemini API unavailable (503). Retrying in 2s (retry ${attempt + 1}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Maps optional file buffers into Gemini multimodal parts alongside the text prompt.
 */
function buildContents(prompt, files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    return prompt;
  }
  const inlineParts = files.map((f) => ({
    inlineData: {
      data: f.buffer.toString('base64'),
      mimeType: f.mimetype || f.mimeType || 'image/png',
    },
  }));
  return [...inlineParts, prompt];
}

/**
 * Generates a plain text response from Gemini using gemini-3.8-flash.
 *
 * @param {string} prompt
 * @param {Array<{ buffer: Buffer, mimetype?: string, mimeType?: string }>} [files=[]]
 * @returns {Promise<string>}
 */
export async function generateText(prompt, files = []) {
  const ai = getClient();
  const contents = buildContents(prompt, files);

  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents,
    })
  );

  return (response.text || '').trim();
}

/**
 * Generates a strict JSON response matching the provided Gemini responseSchema.
 *
 * @param {string} prompt
 * @param {Object} schema
 * @param {Array<{ buffer: Buffer, mimetype?: string, mimeType?: string }>} [files=[]]
 * @returns {Promise<any>}
 */
export async function generateStructuredJSON(prompt, schema, files = []) {
  const ai = getClient();
  const contents = buildContents(prompt, files);

  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    })
  );

  const rawText = response.text;
  try {
    return JSON.parse(rawText);
  } catch (err) {
    console.error('Failed to parse Gemini structured JSON:', rawText);
    throw new Error('Gemini returned an invalid JSON response.');
  }
}
