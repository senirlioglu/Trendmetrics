'use strict';

import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import { createChildLogger } from '../config/logger.js';

const logger = createChildLogger({ module: 'ai-provider' });

// ---------------------------------------------------------------------------
// Abstract Interface
// ---------------------------------------------------------------------------

export interface AIGenerateOptions {
  temperature?: number;
  useGrounding?: boolean;
}

export interface AIProvider {
  generateContent(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateStructuredContent<T>(
    prompt: string,
    schema: string,
    options?: AIGenerateOptions,
  ): Promise<T>;
}

// ---------------------------------------------------------------------------
// JSON Parsing Helpers
// ---------------------------------------------------------------------------

function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  // Remove ```json ... ``` or ``` ... ```
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = fencePattern.exec(text);
  if (match?.[1]) {
    text = match[1].trim();
  }
  return text;
}

function extractJson(raw: string): string {
  const stripped = stripMarkdownFences(raw);

  // Try to find a JSON array or object
  const arrayStart = stripped.indexOf('[');
  const objectStart = stripped.indexOf('{');

  if (arrayStart === -1 && objectStart === -1) {
    return stripped;
  }

  // Pick whichever comes first
  const start =
    arrayStart === -1
      ? objectStart
      : objectStart === -1
        ? arrayStart
        : Math.min(arrayStart, objectStart);

  const isArray = stripped[start] === '[';
  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) depth++;
    if (ch === closeChar) depth--;
    if (depth === 0) {
      return stripped.slice(start, i + 1);
    }
  }

  return stripped;
}

// ---------------------------------------------------------------------------
// Retry Helper
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const isTransient = isTransientError(err);
      if (!isTransient || attempt === maxRetries - 1) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      logger.warn('Transient AI error, retrying', {
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(delay);
    }
  }
  throw lastError;
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('500') ||
      msg.includes('503') ||
      msg.includes('rate') ||
      msg.includes('timeout') ||
      msg.includes('unavailable') ||
      msg.includes('internal')
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Gemini Provider
// ---------------------------------------------------------------------------

class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;
  private readonly defaultModel: string;
  private readonly fallbackModel: string;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    this.defaultModel = config.gemini.defaultModel;
    this.fallbackModel = config.gemini.fallbackModel;
  }

  async generateContent(prompt: string, options?: AIGenerateOptions): Promise<string> {
    return withRetry(async () => {
      const model = this.defaultModel;
      const startTime = Date.now();

      try {
        return await this.callModel(model, prompt, options);
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        logger.warn('Primary model failed, trying fallback', {
          primaryModel: model,
          fallbackModel: this.fallbackModel,
          latencyMs,
          error: err instanceof Error ? err.message : String(err),
        });

        // Attempt fallback model
        try {
          return await this.callModel(this.fallbackModel, prompt, options);
        } catch (fallbackErr: unknown) {
          logger.error('Fallback model also failed', {
            fallbackModel: this.fallbackModel,
            error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
          });
          throw err; // Throw original error for retry logic
        }
      }
    });
  }

  private async callModel(
    model: string,
    prompt: string,
    options?: AIGenerateOptions,
  ): Promise<string> {
    const startTime = Date.now();
    const tools = options?.useGrounding ? [{ googleSearch: {} }] : undefined;

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: options?.temperature ?? 0.7,
        tools,
      },
    });

    const text = response.text ?? '';
    const latencyMs = Date.now() - startTime;

    logger.info('AI content generated', {
      model,
      latencyMs,
      promptLength: prompt.length,
      responseLength: text.length,
      grounding: options?.useGrounding ?? false,
      tokensUsed: response.usageMetadata?.totalTokenCount ?? null,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    });

    return text;
  }

  async generateStructuredContent<T>(
    prompt: string,
    schema: string,
    options?: AIGenerateOptions,
  ): Promise<T> {
    const fullPrompt = `${prompt}

IMPORTANT: Respond ONLY with valid JSON matching this schema:
${schema}

Do NOT include any explanation, markdown fences, or text outside the JSON.`;

    const raw = await this.generateContent(fullPrompt, options);
    const jsonStr = extractJson(raw);

    try {
      return JSON.parse(jsonStr) as T;
    } catch (parseErr: unknown) {
      logger.error('Failed to parse structured AI response', {
        rawResponse: raw.slice(0, 500),
        extractedJson: jsonStr.slice(0, 500),
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      throw new Error(
        `AI returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Factory
// ---------------------------------------------------------------------------

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider();
  }
  return providerInstance;
}
