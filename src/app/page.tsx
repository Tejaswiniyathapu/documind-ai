"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  FileText,
  MessageSquare,
  Plus,
  Upload,
  Search,
  Settings,
  Sparkles,
  Send,
  PanelLeftClose,
  BookOpen,
  Bot,
  Paperclip,
  X,
  Loader2,
  Trash2,
} from "lucide-react";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface Document {
  id: string;
  filename: string;
  file_size: number;
  status: string;
}

interface Source {
  documentName: string;
  pageNumber: number;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface UploadResult {
  success: boolean;
  message: string;
  documentId?: string;
  conversationId?: string;
  filename?: string;
  totalPages?: number;
  totalChunks?: number;
}

type ResponseStyle = "concise" | "balanced" | "detailed";

// --------------------------------------------------
// MARKDOWN MESSAGE COMPONENT
// --------------------------------------------------

function FormattedMessage({ content }: { content: string }) {
  return (
    <div className="break-words text-sm leading-7 text-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 text-2xl font-bold text-slate-900 first:mt-0">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 border-b border-slate-200 pb-2 text-xl font-bold text-slate-900 first:mt-0">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-lg font-semibold text-slate-900">
              {children}
            </h3>
          ),

          h4: ({ children }) => (
            <h4 className="mb-2 mt-4 text-base font-semibold text-slate-900">
              {children}
            </h4>
          ),

          p: ({ children }) => (
            <p className="mb-3 leading-7 last:mb-0">
              {children}
            </p>
          ),

          strong: ({ children }) => (
            <strong className="font-bold text-slate-900">
              {children}
            </strong>
          ),

          em: ({ children }) => (
            <em className="italic text-slate-700">
              {children}
            </em>
          ),

          ul: ({ children }) => (
            <ul className="mb-4 ml-6 list-disc space-y-2">
              {children}
            </ul>
          ),

          ol: ({ children }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-2">
              {children}
            </ol>
          ),

          li: ({ children }) => (
            <li className="pl-1 leading-7">
              {children}
            </li>
          ),

          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-4 border-violet-400 bg-violet-50 py-3 pl-4 pr-3 text-slate-700">
              {children}
            </blockquote>
          ),

          hr: () => (
            <hr className="my-6 border-slate-200" />
          ),

          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-violet-600 underline hover:text-violet-800"
            >
              {children}
            </a>
          ),

          table: ({ children }) => (
            <div className="my-5 w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),

          thead: ({ children }) => (
            <thead className="bg-violet-50 text-slate-900">
              {children}
            </thead>
          ),

          th: ({ children }) => (
            <th className="border-b border-slate-200 px-4 py-3 font-semibold">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="border-b border-slate-100 px-4 py-3 align-top">
              {children}
            </td>
          ),

          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-6 text-slate-100">
              {children}
            </pre>
          ),

          code: ({ children, className }) => {
            const isBlock = Boolean(className);

            return (
              <code
                className={
                  isBlock
                    ? "font-mono text-sm text-violet-200"
                    : "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-violet-700"
                }
              >
                {children}
              </code>
            );
          },

          del: ({ children }) => (
            <del className="text-slate-400">
              {children}
            </del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// --------------------------------------------------
// MAIN PAGE
// --------------------------------------------------

export default function Home() {
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Document state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  const [totalChunks, setTotalChunks] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  const [askingAI, setAskingAI] = useState(false);
  const [chatError, setChatError] = useState("");

  // AI response settings
  const [responseStyle, setResponseStyle] =
    useState<ResponseStyle>("balanced");

  const [settingsOpen, setSettingsOpen] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, askingAI]);

  // Load conversation list on page opening
  useEffect(() => {
    loadConversations();
  }, []);

  // --------------------------------------------------
  // LOAD CONVERSATIONS
  // --------------------------------------------------

  async function loadConversations() {
    try {
      const response = await fetch("/api/conversations");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load conversations."
        );
      }

      setConversations(result.conversations || []);
    } catch (error) {
      console.error("Load conversations error:", error);
    } finally {
      setLoadingConversations(false);
    }
  }

  // --------------------------------------------------
  // RESET CHAT
  // --------------------------------------------------

  function resetChat() {
    setActiveConversationId("");
    setDocuments([]);
    setMessages([]);
    setFile(null);
    setMessage("");

    setUploadError("");
    setUploadMessage("");
    setChatError("");

    setTotalChunks(0);
    setTotalPages(0);

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  // --------------------------------------------------
  // CREATE CONVERSATION
  // --------------------------------------------------

  async function createConversation() {
    if (creatingConversation || uploading || askingAI) {
      return null;
    }

    setCreatingConversation(true);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New conversation",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.conversation?.id) {
        throw new Error(
          result.message || "Unable to create conversation."
        );
      }

      const conversation = result.conversation as Conversation;

      setConversations((previous) => [
        conversation,
        ...previous.filter(
          (item) => item.id !== conversation.id
        ),
      ]);

      setActiveConversationId(conversation.id);

      setDocuments([]);
      setMessages([]);
      setMessage("");

      setUploadError("");
      setUploadMessage("");
      setChatError("");

      setTotalChunks(0);
      setTotalPages(0);

      return conversation.id;
    } catch (error) {
      console.error("Create conversation error:", error);

      setChatError(
        error instanceof Error
          ? error.message
          : "Unable to create conversation."
      );

      return null;
    } finally {
      setCreatingConversation(false);
    }
  }

  // --------------------------------------------------
  // OPEN CONVERSATION
  // --------------------------------------------------

  async function openConversation(id: string) {
    if (uploading || askingAI || creatingConversation) {
      return;
    }

    try {
      setActiveConversationId(id);

      setUploadError("");
      setUploadMessage("");
      setChatError("");
      setFile(null);
      setMessage("");

      const response = await fetch(`/api/conversations/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to open conversation."
        );
      }

      setActiveConversationId(result.conversation.id);
      setMessages(result.messages || []);
      setDocuments(result.documents || []);

      setTotalChunks(0);
      setTotalPages(0);
    } catch (error) {
      console.error("Open conversation error:", error);

      setChatError(
        error instanceof Error
          ? error.message
          : "Unable to open conversation."
      );
    }
  }

  // --------------------------------------------------
  // DELETE CONVERSATION
  // --------------------------------------------------

  async function deleteConversation(
    id: string,
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    if (uploading || askingAI || creatingConversation) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to delete conversation."
        );
      }

      setConversations((previous) =>
        previous.filter((item) => item.id !== id)
      );

      if (activeConversationId === id) {
        resetChat();
      }
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Unable to delete conversation."
      );
    }
  }

  // --------------------------------------------------
  // SELECT PDF
  // --------------------------------------------------

  function handleFile(selectedFile?: File) {
    if (!selectedFile) return;

    setUploadError("");
    setUploadMessage("");

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadError("Please select a valid PDF file.");
      return;
    }

    if (selectedFile.size === 0) {
      setUploadError("The selected PDF is empty.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError("PDF size must not exceed 10 MB.");
      return;
    }

    setFile(selectedFile);
  }

  // --------------------------------------------------
  // UPLOAD PDF
  // --------------------------------------------------

  async function uploadPDF() {
    if (!file || uploading || askingAI || creatingConversation) {
      return;
    }

    const selectedFile = file;

    setUploadError("");
    setUploadMessage("");

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        const newId = await createConversation();

        if (!newId) {
          throw new Error("Unable to create a conversation.");
        }

        conversationId = newId;
      }

      if (!conversationId.trim()) {
        throw new Error("A valid conversation ID is required.");
      }

      setUploading(true);
      setUploadMessage("Uploading and processing your PDF...");

      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("conversationId", conversationId);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result: UploadResult = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "PDF upload failed."
        );
      }

      if (
        result.conversationId &&
        result.conversationId !== conversationId
      ) {
        throw new Error(
          "The PDF was linked to an unexpected conversation."
        );
      }

      setUploadMessage(
        result.message || "PDF processed successfully!"
      );

      setTotalChunks(result.totalChunks || 0);
      setTotalPages(result.totalPages || 0);

      const conversationResponse = await fetch(
        `/api/conversations/${conversationId}`
      );

      const conversationResult = await conversationResponse.json();

      if (
        conversationResponse.ok &&
        conversationResult.success
      ) {
        setDocuments(conversationResult.documents || []);
        setMessages(conversationResult.messages || []);
      }

      setFile(null);

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      await loadConversations();
    } catch (error) {
      console.error("PDF upload error:", error);

      setUploadError(
        error instanceof Error
          ? error.message
          : "Something went wrong during upload."
      );

      setUploadMessage("");
    } finally {
      setUploading(false);
    }
  }

  // --------------------------------------------------
  // ASK AI (STREAMING)
  // --------------------------------------------------

  async function askAI() {
    if (
      !activeConversationId ||
      !message.trim() ||
      askingAI ||
      uploading ||
      documents.length === 0
    ) {
      return;
    }

    const question = message.trim();
    const currentConversationId = activeConversationId;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userMessageId = `user-${requestId}`;
    const assistantMessageId = `assistant-${requestId}`;

    setAskingAI(true);
    setChatError("");
    setMessage("");

    // Show the question and an empty assistant message immediately.
    setMessages((previous) => [
      ...previous,
      {
        id: userMessageId,
        role: "user",
        content: question,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        sources: [],
      },
    ]);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          conversationId: currentConversationId,
          question,
          responseStyle,
        }),
      });

      // Errors returned before streaming starts are regular JSON responses.
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.message || "Unable to get an AI answer."
        );
      }

      if (!response.body) {
        throw new Error("The server did not provide a streaming response.");
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamCompleted = false;
      let receivedMetadata = false;

      const processEvent = (eventBlock: string) => {
        const lines = eventBlock.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).replace(/^ /, ""));
          }
        }

        if (dataLines.length === 0) {
          return;
        }

        let data: any;

        try {
          data = JSON.parse(dataLines.join("\n"));
        } catch {
          throw new Error("The server sent an invalid streaming event.");
        }

        if (eventName === "meta") {
          receivedMetadata = true;

          setMessages((previous) =>
            previous.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    sources: Array.isArray(data.sources)
                      ? data.sources
                      : [],
                  }
                : item
            )
          );

          return;
        }

        if (eventName === "token") {
          if (typeof data.content === "string" && data.content.length > 0) {
            setMessages((previous) =>
              previous.map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      content: item.content + data.content,
                    }
                  : item
              )
            );
          }

          return;
        }

        if (eventName === "done") {
          streamCompleted = true;
          return;
        }

        if (eventName === "error") {
          throw new Error(
            data.message || "Unable to generate an AI answer."
          );
        }
      };

      // Read and parse Server-Sent Events as they arrive.
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const eventBlocks = buffer.split(/\r?\n\r?\n/);
        buffer = eventBlocks.pop() ?? "";

        for (const eventBlock of eventBlocks) {
          if (eventBlock.trim()) {
            processEvent(eventBlock);
          }
        }
      }

      // Process a final event if the stream ended without a trailing blank line.
      if (buffer.trim()) {
        processEvent(buffer);
      }

      if (!receivedMetadata) {
        throw new Error("The server did not send conversation metadata.");
      }

      if (!streamCompleted) {
        throw new Error(
          "The AI response ended unexpectedly. Please try again."
        );
      }

      await loadConversations();
    } catch (error) {
      console.error("Streaming chat error:", error);

      // Remove the unfinished assistant response but keep the user's question.
      setMessages((previous) =>
        previous.filter((item) => item.id !== assistantMessageId)
      );

      setMessage(question);
      setChatError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // The stream may already have closed.
        }
      }

      setAskingAI(false);
    }
  }

  // --------------------------------------------------
  // NEW CHAT
  // --------------------------------------------------

  function startNewChat() {
    if (uploading || askingAI || creatingConversation) {
      return;
    }

    resetChat();
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fc] text-slate-800">

      {/* SIDEBAR */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
            <BookOpen size={20} />
          </div>

          <div>
            <h1 className="font-bold text-slate-900">
              DocuMind AI
            </h1>

            <p className="text-[10px] text-slate-400">
              Intelligent PDF Assistant
            </p>
          </div>
        </div>

        {/* New chat */}
        <div className="p-4">
          <button
            onClick={startNewChat}
            disabled={uploading || askingAI || creatingConversation}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
          >
            <Plus size={18} />
            New chat
          </button>
        </div>

        {/* Workspace */}
        <div className="px-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="flex w-full items-center gap-3 rounded-lg bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-700">
            <FileText size={18} />
            My documents
          </div>

          <div className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600">
            <MessageSquare size={18} />
            Chat history
          </div>
        </div>

        {/* Conversation history */}
        <div className="mt-8 flex-1 overflow-y-auto px-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recent conversations
          </p>

          {loadingConversations ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-4 text-xs text-slate-400">
              Your conversations will appear here.
            </p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => openConversation(conversation.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-3 text-sm transition ${
                    activeConversationId === conversation.id
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <MessageSquare size={16} className="shrink-0" />

                  <span className="min-w-0 flex-1 truncate">
                    {conversation.title}
                  </span>

                  <button
                    onClick={(event) =>
                      deleteConversation(conversation.id, event)
                    }
                    disabled={uploading || askingAI || creatingConversation}
                    className="rounded p-1 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom sidebar */}
        <div className="border-t border-slate-100 p-4">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Settings size={18} />
            Settings
          </button>

          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700">
              U
            </div>

            <div>
              <p className="text-sm font-semibold">
                My Workspace
              </p>

              <p className="text-xs text-slate-400">
                PDF Assistant
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex min-w-0 flex-1 flex-col">

        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
          <div className="flex items-center gap-3">
            <PanelLeftClose size={19} className="text-slate-400" />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Document Workspace
              </p>

              <p className="text-xs text-slate-400">
                Your personal AI reading assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            AI Assistant
          </div>
        </header>

        {/* CHAT WORKSPACE */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">

          {/* Conversation content */}
          <div className="flex-1 overflow-y-auto px-5 py-8 md:px-10">
            <div className="mx-auto w-full max-w-4xl">

              {/* Welcome screen */}
              {messages.length === 0 &&
                documents.length === 0 &&
                !file && (
                  <div className="my-12 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                      <Sparkles size={30} />
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                      Chat with your PDFs
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Upload your documents and let AI help you
                      understand, summarize and discover information.
                    </p>

                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleFile(event.dataTransfer.files[0]);
                      }}
                      onClick={() => fileInput.current?.click()}
                      className="mt-9 cursor-pointer rounded-2xl border-2 border-dashed border-violet-200 bg-white px-6 py-12 text-center shadow-sm transition hover:border-violet-400 hover:bg-violet-50/40"
                    >
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                        <Upload size={26} />
                      </div>

                      <h3 className="font-semibold text-slate-800">
                        Upload your PDF document
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        Drag and drop your PDF here, or browse files
                      </p>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInput.current?.click();
                        }}
                        className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                      >
                        Choose PDF
                      </button>

                      <p className="mt-4 text-xs text-slate-400">
                        PDF files only · Maximum 10 MB
                      </p>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        {
                          icon: MessageSquare,
                          title: "Ask questions",
                          desc: "Get instant answers",
                        },
                        {
                          icon: BookOpen,
                          title: "Understand",
                          desc: "Simplify complex topics",
                        },
                        {
                          icon: Search,
                          title: "Find sources",
                          desc: "Discover relevant pages",
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="rounded-xl border border-slate-200 bg-white p-4 text-left"
                        >
                          <item.icon
                            size={20}
                            className="mb-3 text-violet-600"
                          />

                          <p className="text-sm font-semibold">
                            {item.title}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Attached PDFs */}
              {documents.length > 0 && (
                <div className="mb-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Attached documents
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <FileText
                          size={17}
                          className="shrink-0 text-violet-600"
                        />

                        <span className="max-w-56 truncate text-xs font-medium text-slate-700">
                          {document.filename}
                        </span>

                        <span className="text-[10px] text-emerald-600">
                          Ready
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected file */}
              {file && (
                <div className="mb-6 rounded-xl border border-violet-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <FileText
                      size={25}
                      className="shrink-0 text-violet-600"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {file.name}
                      </p>

                      <p className="text-xs text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      onClick={() => setFile(null)}
                      disabled={uploading}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <button
                    onClick={uploadPDF}
                    disabled={uploading || creatingConversation}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {uploading || creatingConversation ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        {creatingConversation
                          ? "Creating conversation..."
                          : "Processing PDF..."}
                      </>
                    ) : (
                      <>
                        <Upload size={17} />
                        Upload PDF
                      </>
                    )}
                  </button>

                  {uploadMessage && (
                    <p className="mt-3 text-center text-sm text-violet-600">
                      {uploadMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {uploadError}
                </div>
              )}

              {/* Processing summary */}
              {uploadMessage && !file && (
                <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    PDF processed successfully!
                  </p>

                  <p className="mt-2 text-xs text-emerald-700">
                    Pages: {totalPages} · Chunks: {totalChunks}
                  </p>
                </div>
              )}

              {/* CHAT MESSAGES */}
              <div className="space-y-8">
                {messages.map((chatMessage, index) => (
                  <div
                    key={chatMessage.id || `${index}-${chatMessage.role}`}
                    className={`flex gap-3 ${
                      chatMessage.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {chatMessage.role === "assistant" && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                        <Bot
                          size={21}
                          className="text-violet-600"
                        />
                      </div>
                    )}

                    <div
                      className={`min-w-0 max-w-[92%] rounded-2xl px-4 py-4 md:max-w-[88%] ${
                        chatMessage.role === "user"
                          ? "bg-violet-600 text-white"
                          : "border border-slate-200 bg-white shadow-sm"
                      }`}
                    >
                      {chatMessage.role === "assistant" && (
                        <p className="mb-3 text-xs font-semibold text-violet-600">
                          DocuMind AI
                        </p>
                      )}

                      {chatMessage.role === "user" ? (
                        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-white">
                          {chatMessage.content}
                        </div>
                      ) : (
                        <FormattedMessage content={chatMessage.content} />
                      )}

                      {/* Sources */}
                      {chatMessage.role === "assistant" &&
                        chatMessage.sources &&
                        chatMessage.sources.length > 0 && (
                          <div className="mt-5 border-t border-slate-100 pt-4">
                            <p className="mb-3 text-xs font-semibold text-slate-500">
                              Sources from your documents
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {chatMessage.sources.map(
                                (source, sourceIndex) => (
                                  <span
                                    key={`${source.documentName}-${source.pageNumber}-${sourceIndex}`}
                                    className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs text-violet-700"
                                  >
                                    {source.documentName} · Page{" "}
                                    {source.pageNumber}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}

                {/* AI loading */}
                {askingAI && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                      <Bot
                        size={21}
                        className="text-violet-600"
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                      <Loader2
                        size={15}
                        className="mr-2 inline animate-spin"
                      />
                      DocuMind AI is thinking...
                    </div>
                  </div>
                )}
              </div>

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* CHAT ERROR */}
          {chatError && (
            <div className="mx-auto mb-2 w-full max-w-4xl px-5">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {chatError}
              </div>
            </div>
          )}

          {/* CHAT INPUT */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 md:px-10">
            <div className="mx-auto max-w-4xl">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  askAI();
                }}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100"
              >
                <textarea
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      askAI();
                    }
                  }}
                  placeholder={
                    documents.length > 0
                      ? "Ask anything about your PDFs..."
                      : "Upload a PDF to start chatting..."
                  }
                  disabled={
                    documents.length === 0 ||
                    askingAI ||
                    uploading
                  }
                  className="min-h-16 max-h-40 w-full resize-y bg-transparent p-2 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={uploading || askingAI}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                      title="Attach PDF"
                    >
                      <Paperclip size={19} />
                    </button>

                    {documents.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {documents.length} PDF
                        {documents.length !== 1 ? "s" : ""} attached
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      !message.trim() ||
                      documents.length === 0 ||
                      askingAI ||
                      uploading
                    }
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send
                    <Send size={15} />
                  </button>
                </div>
              </form>

              <p className="mt-2 text-center text-[11px] text-slate-400">
                DocuMind AI can make mistakes. Verify important information with your documents.
              </p>
            </div>
          </div>
        </section>

        {/* HIDDEN PDF INPUT */}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {/* FOOTER */}
        <footer className="hidden border-t border-slate-200 bg-white px-5 py-2 text-center text-xs text-slate-400">
          DocuMind AI · Intelligent document understanding
        </footer>
      </main>

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Settings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Customize how DocuMind AI responds.
                </p>
              </div>

              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                Response style
              </h3>

              <p className="mb-4 text-xs leading-5 text-slate-500">
                Choose how much detail the AI should include in its answers.
              </p>

              <div className="space-y-3">
                {[
                  {
                    value: "concise",
                    title: "Concise",
                    description:
                      "Short, direct answers with only the essential information.",
                  },
                  {
                    value: "balanced",
                    title: "Balanced",
                    description:
                      "Clear explanations with useful details and examples.",
                  },
                  {
                    value: "detailed",
                    title: "Detailed",
                    description:
                      "In-depth explanations, examples, and step-by-step guidance.",
                  },
                ].map((style) => (
                  <button
                    key={style.value}
                    onClick={() =>
                      setResponseStyle(
                        style.value as ResponseStyle
                      )
                    }
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      responseStyle === style.value
                        ? "border-violet-500 bg-violet-50"
                        : "border-slate-200 hover:border-violet-300"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        responseStyle === style.value
                          ? "border-violet-600"
                          : "border-slate-300"
                      }`}
                    >
                      {responseStyle === style.value && (
                        <div className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {style.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {style.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                Changes apply to your next question.
              </p>

              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}