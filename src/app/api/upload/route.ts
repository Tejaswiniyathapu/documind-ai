
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateEmbeddings } from "@/lib/embeddings";
import type { PoolClient } from "pg";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

// Keep batches reasonably large to avoid excessive API requests.
const EMBEDDING_BATCH_SIZE = 32;

// Pause between embedding requests.
const EMBEDDING_BATCH_DELAY_MS = 1500;

type DocumentChunk = {
  chunkIndex: number;
  content: string;
  pageNumber: number;
  embedding: number[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  let filePath: string | null = null;
  let client: PoolClient | undefined;
  let transactionStarted = false;

  try {
    // 1. Read uploaded file and conversation ID
    const formData = await request.formData();

    const file = formData.get("file");
    const conversationId = formData.get("conversationId");

    if (
      typeof conversationId !== "string" ||
      !conversationId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid conversation ID is required.",
        },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please upload a PDF file.",
        },
        { status: 400 }
      );
    }

    // 2. Validate file size
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "PDF must be between 1 byte and 10 MB.",
        },
        { status: 400 }
      );
    }

    // 3. Validate PDF type
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Only PDF files are allowed.",
        },
        { status: 400 }
      );
    }

    // 4. Read and validate PDF content
    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.subarray(0, 5).toString() !== "%PDF-") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid PDF file.",
        },
        { status: 400 }
      );
    }

    // 5. Verify that the conversation exists
    const conversationResult = await pool.query(
      `SELECT id FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Conversation not found.",
        },
        { status: 404 }
      );
    }

    // 6. Generate document ID and save PDF
    const documentId = randomUUID();

    const uploadDirectory = path.join(
      process.cwd(),
      "uploads"
    );

    await mkdir(uploadDirectory, { recursive: true });

    filePath = path.join(
      uploadDirectory,
      `${documentId}.pdf`
    );

    await writeFile(filePath, buffer);

    // 7. Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs"
      )
    ).href;

    // 8. Extract PDF text
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    const pages: {
      pageNumber: number;
      text: string;
    }[] = [];

    try {
      for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (pageText) {
          pages.push({
            pageNumber,
            text: pageText,
          });
        }
      }
    } finally {
      await loadingTask.destroy();
    }

    // 9. Check whether the PDF contains readable text
    if (pages.length === 0) {
      await unlink(filePath).catch(() => {});
      filePath = null;

      return NextResponse.json(
        {
          success: false,
          message:
            "No readable text was found in this PDF. It may be a scanned document.",
        },
        { status: 400 }
      );
    }

    // 10. Split text into chunks
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      for (
        let start = 0;
        start < page.text.length;
        start += CHUNK_SIZE - CHUNK_OVERLAP
      ) {
        const chunk = page.text
          .slice(start, start + CHUNK_SIZE)
          .trim();

        if (!chunk) {
          continue;
        }

        chunks.push({
          chunkIndex: chunkIndex++,
          content: chunk,
          pageNumber: page.pageNumber,
          embedding: [],
        });
      }
    }

    // 11. Generate embeddings in controlled batches
    for (
      let start = 0;
      start < chunks.length;
      start += EMBEDDING_BATCH_SIZE
    ) {
      const batch = chunks.slice(
        start,
        start + EMBEDDING_BATCH_SIZE
      );

      console.log(
        `Generating embeddings: ${start + 1}-${start + batch.length} of ${chunks.length}`
      );

      const embeddings = await generateEmbeddings(
        batch.map((chunk) => chunk.content),
        "RETRIEVAL_DOCUMENT"
      );

      if (embeddings.length !== batch.length) {
        throw new Error(
          "The number of generated embeddings does not match the number of chunks."
        );
      }

      batch.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });

      // Pause before requesting the next batch.
      if (start + EMBEDDING_BATCH_SIZE < chunks.length) {
        await sleep(EMBEDDING_BATCH_DELAY_MS);
      }
    }

    // 12. Verify all embeddings before saving
    const invalidEmbedding = chunks.some(
      (chunk) =>
        chunk.embedding.length !== 768 ||
        chunk.embedding.some(
          (value) => !Number.isFinite(value)
        )
    );

    if (invalidEmbedding) {
      throw new Error(
        "One or more generated embeddings are invalid."
      );
    }

    // 13. Connect to PostgreSQL
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // 14. Save document information
    await client.query(
      `INSERT INTO documents
       (id, filename, file_size, file_path, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        documentId,
        file.name,
        file.size,
        filePath,
        "processed",
      ]
    );

    // 15. Save document chunks and embeddings
    for (const chunk of chunks) {
      const embeddingString = `[${chunk.embedding.join(",")}]`;

      await client.query(
        `INSERT INTO document_chunks
         (document_id, chunk_index, content, page_number, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          documentId,
          chunk.chunkIndex,
          chunk.content,
          chunk.pageNumber,
          embeddingString,
        ]
      );
    }

    // 16. Link the document to the conversation
    await client.query(
      `INSERT INTO conversation_documents
       (conversation_id, document_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [conversationId, documentId]
    );

    // 17. Commit transaction
    await client.query("COMMIT");
    transactionStarted = false;

    // 18. Return success
    return NextResponse.json({
      success: true,
      message:
        "PDF uploaded, text extracted, and embeddings generated successfully!",
      documentId,
      conversationId,
      filename: file.name,
      totalPages,
      extractedPages: pages.length,
      totalChunks: chunks.length,
      embeddedChunks: chunks.length,
    });
  } catch (error: unknown) {
    console.error("PDF upload error:", error);

    // 19. Roll back database transaction
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
        transactionStarted = false;
      } catch (rollbackError) {
        console.error(
          "Database rollback error:",
          rollbackError
        );
      }
    }

    // 20. Remove incomplete PDF file
    if (filePath) {
      await unlink(filePath).catch(() => {});
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error";

    const isRateLimit =
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED");

    return NextResponse.json(
      {
        success: false,
        message: isRateLimit
          ? "Gemini embedding quota exceeded. Please wait before uploading again."
          : "PDF processing failed. Check server logs.",
        details: errorMessage,
      },
      {
        status: isRateLimit ? 429 : 500,
      }
    );
  } finally {
    // 21. Release PostgreSQL connection
    client?.release();
  }
}
