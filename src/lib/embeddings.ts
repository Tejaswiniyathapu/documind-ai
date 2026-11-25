
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env.local");
}

const ai = new GoogleGenAI({ apiKey });

const MAX_RETRIES = 5;

function getErrorDetails(error: unknown): string {
  const details: string[] = [];
  let current: unknown = error;

  for (let i = 0; i < 4 && current; i++) {
    if (current instanceof Error) {
      details.push(current.message);
    }

    if (typeof current === "object") {
      const item = current as {
        code?: unknown;
        status?: unknown;
        cause?: unknown;
      };

      if (item.code) details.push(String(item.code));
      if (item.status) details.push(String(item.status));

      current = item.cause;
    } else {
      break;
    }
  }

  return details.join(" ").toLowerCase();
}

function isRetryableError(error: unknown): boolean {
  const message = getErrorDetails(error);

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;

  return (
    status === 429 ||
    status >= 500 ||
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("fetch failed") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("connecttimeout") ||
    message.includes("und_err")
  );
}

function getRetryDelay(error: unknown, attempt: number): number {
  const message = getErrorDetails(error);

  const retryMatch = message.match(/retrydelay["']?\s*:\s*["']?(\d+)s/i);

  if (retryMatch) {
    return (Number(retryMatch[1]) + 5) * 1000;
  }

  return Math.min(10000 * Math.pow(2, attempt), 120000);
}

export async function generateEmbeddings(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `Gemini embedding request: ${texts.length} texts`
      );

      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: texts,
        config: {
          outputDimensionality: 768,
          taskType,
          httpOptions: {
            timeout: 60000,
          },
        },
      });

      const embeddings = response.embeddings?.map(
        (item) => item.values ?? []
      );

      if (
        !embeddings ||
        embeddings.length !== texts.length ||
        embeddings.some((item) => item.length !== 768)
      ) {
        throw new Error("Gemini returned invalid embeddings.");
      }

      console.log(
        `Successfully generated ${embeddings.length} embeddings.`
      );

      return embeddings;
    } catch (error: unknown) {
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        console.error("Gemini embedding generation failed:", error);
        throw error;
      }

      const delay = getRetryDelay(error, attempt);

      console.warn(
        `Gemini request failed. Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.ceil(delay / 1000)} seconds.`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unable to generate embeddings after retries.");
}
