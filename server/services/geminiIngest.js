import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Extracts subjects and recurring timetable slots from one or more image/PDF buffers.
 * Passes all files together in a single Gemini call and instructs the model to merge
 * and deduplicate entries.
 *
 * @param {Array<{ buffer: Buffer, mimetype?: string, mimeType?: string }>|Buffer} files
 * @param {string} [legacyMimeType] - Fallback mimeType if single buffer passed
 * @returns {Promise<{ subjects: Array, timetableSlots: Array }>}
 */
export async function parseTimetableFiles(files, legacyMimeType) {
  const fileList = Array.isArray(files)
    ? files
    : [{ buffer: files, mimeType: legacyMimeType || 'image/png' }];

  if (!fileList || fileList.length === 0) {
    throw new Error('No files provided for timetable parsing.');
  }

  const ai = getGeminiClient();

  // Map every file to an inlineData part
  const inlineParts = fileList.map((f) => ({
    inlineData: {
      data: f.buffer.toString('base64'),
      mimeType: f.mimetype || f.mimeType || 'image/png',
    },
  }));

  const prompt = `You are an expert academic schedule parser.
Analyze all attached timetable documents (images and/or PDFs) and extract a single, merged, and deduplicated academic schedule.

Rules:
1. Merge schedules across all uploaded documents into one comprehensive timetable. If identical subjects or timetable slots appear across multiple files, deduplicate them so each slot appears only once.
2. Day of week must be an integer: 0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday.
3. Time format must be 24-hour "HH:MM" (e.g., "09:00", "13:30").
4. For subjects, extract subject name, subject code (e.g., "CS101"), and faculty name if available (otherwise empty string).
5. For each timetable slot, map subjectCode back to the subject's code. If no code exists, use the subject name as the identifier.
6. Return ONLY a valid JSON object matching the requested schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [...inlineParts, prompt],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          subjects: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                code: { type: 'STRING' },
                faculty: { type: 'STRING' },
              },
              required: ['name', 'code'],
            },
          },
          timetableSlots: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                subjectCode: { type: 'STRING' },
                dayOfWeek: { type: 'INTEGER' },
                startTime: { type: 'STRING' },
                endTime: { type: 'STRING' },
                room: { type: 'STRING' },
              },
              required: ['subjectCode', 'dayOfWeek', 'startTime'],
            },
          },
        },
        required: ['subjects', 'timetableSlots'],
      },
    },
  });

  const rawText = response.text;
  try {
    return JSON.parse(rawText);
  } catch (err) {
    console.error('Failed to parse Gemini timetable response:', rawText);
    throw new Error('Gemini returned an invalid JSON response.');
  }
}

// Backward-compatibility alias
export const parseTimetableFile = parseTimetableFiles;

/**
 * Extracts official holidays from one or more calendar/holiday documents.
 * Merges and deduplicates holiday dates across all uploaded files.
 *
 * @param {Array<{ buffer: Buffer, mimetype?: string, mimeType?: string }>|Buffer} files
 * @param {string} [legacyMimeType] - Fallback mimeType if single buffer passed
 * @returns {Promise<{ holidays: Array<{ name: string, date: string }> }>}
 */
export async function parseHolidayFiles(files, legacyMimeType) {
  const fileList = Array.isArray(files)
    ? files
    : [{ buffer: files, mimeType: legacyMimeType || 'image/png' }];

  if (!fileList || fileList.length === 0) {
    throw new Error('No files provided for holiday parsing.');
  }

  const ai = getGeminiClient();

  // Map every file to an inlineData part
  const inlineParts = fileList.map((f) => ({
    inlineData: {
      data: f.buffer.toString('base64'),
      mimeType: f.mimetype || f.mimeType || 'image/png',
    },
  }));

  const prompt = `You are an expert academic calendar parser.
Analyze all attached calendar or holiday documents (images and/or PDFs) and extract all official holidays into a single merged and deduplicated list.

Rules:
1. Merge holidays across all attached documents. If a holiday on the same date appears across multiple documents, deduplicate it.
2. Date must strictly be formatted as "YYYY-MM-DD" (e.g., "2026-11-27"). If the year is not mentioned, assume the current academic year 2026.
3. Name must be the name or description of the holiday/observance.
4. Return ONLY a valid JSON object matching the requested schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [...inlineParts, prompt],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          holidays: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                date: { type: 'STRING' },
              },
              required: ['name', 'date'],
            },
          },
        },
        required: ['holidays'],
      },
    },
  });

  const rawText = response.text;
  try {
    return JSON.parse(rawText);
  } catch (err) {
    console.error('Failed to parse Gemini holiday response:', rawText);
    throw new Error('Gemini returned an invalid JSON response.');
  }
}

// Backward-compatibility alias
export const parseHolidayFile = parseHolidayFiles;
