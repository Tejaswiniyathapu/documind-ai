# DocuMind AI — Chat with Your PDFs

DocuMind AI is an AI-powered PDF question-answering application that allows users to upload PDF documents and ask questions about their contents using natural language.

It uses document embeddings and vector search to retrieve relevant information, then generates contextual answers with an AI language model.

## Features

- **PDF Upload:** Upload and process PDF documents.
- **AI-Powered Question Answering:** Ask questions about uploaded documents.
- **Semantic Search:** Retrieve relevant document chunks using vector embeddings.
- **Hybrid Retrieval:** Combine vector similarity search and keyword search using Reciprocal Rank Fusion (RRF).
- **Conversation History:** Create, manage, and revisit conversations.
- **Context-Aware Responses:** Use previous conversation messages to support follow-up questions.
- **Source References:** Display document sources and page references.
- **Streaming Responses:** Display AI responses as they are generated.
- **Response Styles:** Choose concise, balanced, or detailed answers.
- **Markdown Formatting:** Render structured answers, lists, tables, and code blocks.

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack application framework |
| React | User interface |
| TypeScript | Type-safe development |
| PostgreSQL | Database |
| pgvector | Vector similarity search |
| Gemini Embedding API | Document and query embeddings |
| Groq API | AI-generated responses |
| PDF.js | PDF text extraction |
| React Markdown | Markdown response rendering |
| Tailwind CSS | Styling |

## Architecture

1. A user uploads a PDF.
2. PDF.js extracts its text.
3. The extracted text is divided into smaller chunks.
4. Gemini generates 768-dimensional embeddings for the chunks.
5. Document information, chunks, and embeddings are stored in PostgreSQL with pgvector.
6. When a user asks a question, the application generates a query embedding.
7. Hybrid retrieval combines vector search and keyword search.
8. Reciprocal Rank Fusion combines the search results.
9. Relevant chunks and conversation history are passed to the Groq language model.
10. The answer is streamed to the user with source references.

## Prerequisites

- Node.js and npm
- Docker Desktop
- A PostgreSQL database with the pgvector extension
- Gemini API key
- Groq API key

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Tejaswiniyathapu/documind-ai.git
cd documind-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
DATABASE_URL=your_postgresql_connection_string
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

Replace the placeholder values with your own credentials.

Never commit `.env.local` or expose API keys publicly.

### 4. Configure PostgreSQL

Create a PostgreSQL database with the pgvector extension and configure the required database tables and schema before starting the application.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```text
documind-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   ├── conversations/
│   │   │   └── upload/
│   │   └── page.tsx
│   └── lib/
│       ├── db.ts
│       └── embeddings.ts
├── public/
├── .gitignore
├── package.json
├── package-lock.json
├── next.config.ts
└── README.md
```

## Available Scripts

```bash
npm run dev
```
Starts the development server.

```bash
npm run build
```
Builds the application for production.

```bash
npm run start
```
Starts the production server.

```bash
npm run lint
```
Runs ESLint.

## Future Improvements

- Deploy the application to a production hosting platform.
- Add support for additional document formats.
- Improve document management and retrieval.
- Add authentication and user-specific document libraries.

## Author

**Tejaswini Yathapu**

GitHub: [Tejaswiniyathapu](https://github.com/Tejaswiniyathapu)
