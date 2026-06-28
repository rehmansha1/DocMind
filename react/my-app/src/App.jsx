import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  SUGGESTED_QUESTIONS,
} from "./config";
import LoginPage from "./LoginPage";
import { askQuestion, uploadDocument, fetchDocuments, deleteDocument, crawlWebsite } from "./services/ragApi";
import { createDocumentFromFile, formatBytes, formatTime, getFileExtension } from "./utils/files";

const STATUS_COPY = {
  ready: "indexed",
  processing: "indexing",
  error: "failed",
};

/* ═══════════════════════════════════════════
   SIMPLE MARKDOWN PARSER (no dependencies)
   ═══════════════════════════════════════════ */

function parseMarkdown(text) {
  if (!text) return text;

  // Split into lines to handle block-level elements
  const lines = text.split("\n");
  const result = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeBlockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks (```)
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        result.push(
          <pre key={`code-${codeBlockIndex++}`}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      result.push(<br key={`br-${i}`} />);
      continue;
    }

    // Unordered list items
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^\s*[-*]\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*[-*]\s+/, ""));
        j++;
      }
      result.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      i = j - 1;
      continue;
    }

    // Ordered list items
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^\s*\d+[.)]\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*\d+[.)]\s+/, ""));
        j++;
      }
      result.push(
        <ol key={`ol-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ol>
      );
      i = j - 1;
      continue;
    }

    // Regular text with inline formatting
    result.push(
      <span key={`line-${i}`}>
        {parseInline(line)}
        {i < lines.length - 1 ? "\n" : ""}
      </span>
    );
  }

  // Unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    result.push(
      <pre key={`code-${codeBlockIndex}`}>
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
  }

  return result;
}

function parseInline(text) {
  if (!text) return text;

  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(parseInlineFormatting(codeMatch[1], key++));
      parts.push(<code key={`ic-${key++}`}>{codeMatch[2]}</code>);
      remaining = codeMatch[3];
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(parseInlineFormatting(boldMatch[1], key++));
      parts.push(<strong key={`b-${key++}`}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(italicMatch[1]);
      parts.push(<em key={`i-${key++}`}>{italicMatch[2]}</em>);
      remaining = italicMatch[3];
      continue;
    }

    // No match, push remaining text
    parts.push(remaining);
    break;
  }

  return parts.length === 1 ? parts[0] : parts;
}

function parseInlineFormatting(text, baseKey) {
  // Handle bold within pre-match text
  const boldMatch = text.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
  if (boldMatch) {
    return (
      <span key={`pif-${baseKey}`}>
        {boldMatch[1]}
        <strong>{boldMatch[2]}</strong>
        {boldMatch[3]}
      </span>
    );
  }
  return text;
}

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */

function CloseIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "relative", zIndex: 2 }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ToastIcon({ type }) {
  if (type === "success") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   SMALL COMPONENTS
   ═══════════════════════════════════════════ */

function Logo() {
  return (
    <div className="logo">
      <div className="logo-dot" />
      DocMind
    </div>
  );
}

function StatusBadge({ readyCount }) {
  return (
    <span className={`badge ${readyCount > 0 ? "active" : "inactive"}`}>
      {readyCount > 0 ? `${readyCount} docs` : "no docs"}
    </span>
  );
}

function UploadZone({ dragOver, onDragOver, onDragLeave, onDrop, onFilesSelected }) {
  return (
    <div
      className={`upload-zone${dragOver ? " drag-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES.join(",")}
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="upload-icon">
        <UploadIcon />
      </div>
      <div className="upload-title">Drop files here</div>
      <div className="upload-sub">PDF, TXT, MD, DOCX, CSV, JSON</div>
    </div>
  );
}

function DocumentItem({ doc, active, onSelect, onRemove }) {
  const iconClass = ["pdf", "txt", "md", "web"].includes(doc.ext) ? doc.ext : "";

  return (
    <div className={`doc-item${active ? " active" : ""}`} onClick={onSelect}>
      <div className={`doc-icon ${iconClass}`}>{doc.ext.toUpperCase().slice(0, 3)}</div>
      <div className="doc-info">
        <div className="doc-name" title={doc.name}>
          {doc.name}
        </div>
        {doc.status === "processing" && doc.progress !== undefined && (
          <div className="doc-progress-bar-container">
            <div className="doc-progress-bar-fill" style={{ width: `${doc.progress}%` }} />
          </div>
        )}
        <div className="doc-meta">
          {doc.size > 0 ? `${formatBytes(doc.size)} — ` : ""}
          {doc.status === "processing" ? (
            <span>{doc.progress !== undefined ? `${doc.progress}%` : "0%"} {doc.progressMsg ?? "indexing"}</span>
          ) : doc.chunks ? (
            `${doc.chunks} chunks`
          ) : doc.status === "error" ? (
            "upload failed"
          ) : ""}
        </div>
      </div>
      <div className={`doc-status ${doc.status}`} title={STATUS_COPY[doc.status] ?? doc.status} />
      <button
        className="doc-remove"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${doc.name}`}
        title="Remove"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function Sidebar({
  activeDoc,
  docs,
  dragOver,
  onClose,
  onDragLeave,
  onDragOver,
  onDrop,
  onFilesSelected,
  onRemoveDoc,
  onSelectDoc,
  sidebarOpen,
  crawlUrl,
  crawling,
  onCrawlUrlChange,
  onCrawlSubmit,
}) {
  return (
    <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
      <div className="sidebar-header">
        <Logo />
        <div className="logo-sub">AI Support — RAG Engine</div>
        <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close documents" title="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="upload-section">
        <UploadZone
          dragOver={dragOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onFilesSelected={onFilesSelected}
        />
      </div>

      <div className="crawl-section">
        <div className="crawl-title">Or Crawl Website Domain</div>
        <form onSubmit={onCrawlSubmit} className="crawl-form">
          <input
            type="url"
            placeholder="https://example.com"
            value={crawlUrl}
            onChange={(e) => onCrawlUrlChange(e.target.value)}
            disabled={crawling}
            className="crawl-input"
            required
          />
          <button type="submit" disabled={crawling} className="crawl-btn">
            {crawling ? "Crawling..." : "Crawl & Index"}
          </button>
        </form>
      </div>

      <div className="docs-section">
        {docs.length > 0 ? (
          <div className="docs-label">Knowledge Base ({docs.length})</div>
        ) : (
          <div className="empty-docs">
            No documents yet.
            <br />
            Upload files to get started.
          </div>
        )}

        {docs.map((doc) => (
          <DocumentItem
            key={doc.id}
            doc={doc}
            active={activeDoc === doc.id}
            onSelect={() => onSelectDoc(doc.id)}
            onRemove={() => onRemoveDoc(doc.id)}
          />
        ))}
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════
   USER DROPDOWN
   ═══════════════════════════════════════════ */

function UserDropdown({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = useMemo(() => {
    if (!user) return "?";
    const name = user.name || user.email || "";
    const parts = name.split(/[\s@]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || "U";
  }, [user]);

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";

  return (
    <div className="user-dropdown-wrap" ref={wrapRef}>
      <button
        className="user-avatar-btn"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="User menu"
        title={displayName}
      >
        {initials}
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-info">
            <div className="user-dropdown-name">{displayName}</div>
            {displayEmail && <div className="user-dropdown-email">{displayEmail}</div>}
          </div>
          <button
            className="user-dropdown-item danger"
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   HEADER ACTIONS
   ═══════════════════════════════════════════ */

function HeaderActions({ messagesCount, onClearChat, onOpenSidebar, readyCount, user, onSignOut, mobile = false }) {
  return (
    <div className={mobile ? "mobile-actions" : "header-actions"}>
      <StatusBadge readyCount={readyCount} />
      {messagesCount > 0 && (
        <button className="icon-btn" type="button" onClick={onClearChat} aria-label="Clear chat" title="Clear chat">
          <TrashIcon />
        </button>
      )}
      {user && <UserDropdown user={user} onSignOut={onSignOut} />}
      {mobile && (
        <button className="hamburger" type="button" onClick={onOpenSidebar} aria-label="Open documents" title="Open documents">
          <span />
          <span />
          <span />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════ */

function EmptyState({ readyCount, onSuggestion }) {
  return (
    <div className="empty-state">
      <div className="empty-orb">
        <SearchIcon />
      </div>
      <div className="empty-title">Ask your documents anything</div>
      <div className="empty-desc">
        {readyCount > 0
          ? "Your knowledge base is ready. Ask a question below to search across your documents."
          : "Upload PDFs, text files, or markdown to build your knowledge base, then ask questions in natural language."}
      </div>
      {readyCount > 0 && (
        <div className="suggested-chips">
          {SUGGESTED_QUESTIONS.map((suggestion) => (
            <button key={suggestion} className="chip" type="button" onClick={() => onSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TYPING INDICATOR
   ═══════════════════════════════════════════ */

function TypingIndicator() {
  return (
    <div className="message-row ai">
      <div className="msg-avatar ai">AI</div>
      <div className="msg-content">
        <div className="msg-bubble">
          <div className="typing-dots">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SOURCE PILL
   ═══════════════════════════════════════════ */

function SourcePill({ source }) {
  const label = typeof source === "string" ? source : source.text ?? source.name ?? "Source";
  const score = typeof source === "object" && source.score ? `Similarity: ${source.score}` : undefined;
  const displayLabel = label.length > 44 ? `${label.slice(0, 44)}...` : label;

  return (
    <span className="source-pill" title={score ?? label}>
      <FileIcon />
      {displayLabel}
    </span>
  );
}

/* ═══════════════════════════════════════════
   MESSAGE WITH COPY BUTTON & MARKDOWN
   ═══════════════════════════════════════════ */

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [text]);

  return (
    <button
      className={`msg-copy-btn${copied ? " copied" : ""}`}
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? <CheckSmallIcon /> : <CopyIcon />}
    </button>
  );
}

function Message({ message, isLatest, onSelectSuggestion }) {
  const isAI = message.role === "ai";

  return (
    <div className={`message-row ${message.role}`}>
      <div className={`msg-avatar ${message.role}`}>{isAI ? "AI" : "U"}</div>
      <div className="msg-content">
        {isAI && <CopyButton text={message.text} />}
        <div className="msg-bubble">
          {isAI ? parseMarkdown(message.text) : message.text}
        </div>
        {message.sources?.length > 0 && (
          <div className="sources">
            {message.sources.map((source, index) => (
              <SourcePill key={`${message.id}-${index}`} source={source} />
            ))}
          </div>
        )}
        
        {isAI && isLatest && message.suggestions?.length > 0 && (
          <div className="message-suggestions">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={`sugg-${index}`}
                className="suggestion-pill"
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="msg-time">{formatTime(message.time)}</div>
      </div>
    </div>
  );
}

function Messages({ loading, messages, messagesEndRef, onSelectSuggestion }) {
  return (
    <div className="messages">
      {messages.map((message, index) => (
        <Message
          key={message.id}
          message={message}
          isLatest={index === messages.length - 1}
          onSelectSuggestion={onSelectSuggestion}
        />
      ))}
      {loading && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHAT INPUT
   ═══════════════════════════════════════════ */

function ChatInput({ disabled, input, loading, onChange, onKeyDown, onSend, readyCount }) {
  return (
    <div className="input-area">
      <div className="input-wrapper">
        <textarea
          className="chat-input"
          rows={1}
          placeholder={readyCount > 0 ? "Ask a question about your documents..." : "Upload documents to start chatting..."}
          value={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
        <button className="send-btn" type="button" onClick={onSend} disabled={disabled} aria-label="Send" title="Send">
          <SendIcon />
        </button>
      </div>
      <div className="input-footer">
        <div className="input-hint">
          <span className={`input-hint-dot ${loading ? "active" : "idle"}`} />
          {loading ? "Searching your documents..." : "Ready for document questions"}
        </div>
        <div className="model-selector">llama3.2 — nomic-embed</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════ */

function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className={`toast ${toast.type}`}>
      <ToastIcon type={toast.type} />
      {toast.message}
    </div>
  );
}

/* ═══════════════════════════════════════════
   APP (ROOT)
   ═══════════════════════════════════════════ */

export default function App() {
  const [activeDoc, setActiveDoc] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("docmind_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [docs, setDocs] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const messagesEndRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const readyCount = useMemo(() => docs.filter((doc) => doc.status === "ready").length, [docs]);
  const hasProcessingDocs = useMemo(() => docs.some((doc) => doc.status === "processing"), [docs]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const updateDoc = useCallback((id, changes) => {
    setDocs((currentDocs) => currentDocs.map((doc) => (doc.id === id ? { ...doc, ...changes } : doc)));
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("docmind_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("docmind_user");
    }
  }, [currentUser]);

  const loadUserDocuments = useCallback(async () => {
    if (!currentUser?.email) {
      setDocs([]);
      return;
    }
    try {
      const data = await fetchDocuments(currentUser.email);
      if (data.success) {
        const userDocs = (data.documents || []).map((d) => ({
          id: d.name,
          name: d.name,
          ext: d.name.startsWith("http://") || d.name.startsWith("https://") ? "web" : getFileExtension(d.name),
          size: 0,
          status: "ready",
          chunks: d.chunks,
        }));
        setDocs(userDocs);
      }
    } catch (error) {
      console.error("Failed to fetch user documents:", error);
      showToast("Failed to load your documents from server.", "error");
    }
  }, [currentUser?.email, showToast]);

  useEffect(() => {
    loadUserDocuments();
  }, [loadUserDocuments]);

  const handleCrawlSubmit = useCallback(async (e) => {
    e.preventDefault();
    const url = crawlUrl.trim();
    if (!url || crawling) return;

    setCrawling(true);
    setCrawlUrl("");

    const docId = `crawl-${Date.now()}`;
    const tempDoc = {
      id: docId,
      name: url,
      size: 0,
      ext: "web",
      status: "processing",
      progress: 0,
      progressMsg: "Initializing...",
      addedAt: new Date(),
    };
    
    setDocs((currentDocs) => [...currentDocs, tempDoc]);

    try {
      const result = await crawlWebsite(url, currentUser?.email, (progressData) => {
        updateDoc(docId, {
          progress: progressData.progress,
          progressMsg: progressData.message,
        });
      });

      showToast(`Website crawled successfully! Scraped ${result.pages} pages.`);
      setDocs((currentDocs) => currentDocs.filter((d) => d.id !== docId));
      await loadUserDocuments();

    } catch (error) {
      updateDoc(docId, { status: "error", progress: undefined, progressMsg: undefined });
      showToast(error.message || `Failed to crawl ${url}`, "error");
    } finally {
      setCrawling(false);
    }
  }, [crawlUrl, crawling, currentUser?.email, loadUserDocuments, updateDoc, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) return;

      for (const file of files) {
        const ext = getFileExtension(file.name);

        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          showToast(`Unsupported file: .${ext}`, "error");
          continue;
        }

        const doc = createDocumentFromFile(file);
        setDocs((currentDocs) => [...currentDocs, doc]);

        try {
          const result = await uploadDocument(file, currentUser?.email, (progressData) => {
            updateDoc(doc.id, {
              progress: progressData.progress,
              progressMsg: progressData.message,
            });
          });
          updateDoc(doc.id, {
            status: "ready",
            chunks: result.chunks ?? result.chunkCount,
            progress: undefined,
            progressMsg: undefined,
          });
          showToast(`"${file.name}" indexed successfully`);
        } catch (error) {
          updateDoc(doc.id, { status: "error", progress: undefined, progressMsg: undefined });
          showToast(error.message || `Failed to upload ${file.name}`, "error");
        }
      }
    },
    [showToast, updateDoc],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const removeDoc = useCallback(
    async (id) => {
      const docToRemove = docs.find((doc) => doc.id === id);
      if (!docToRemove) return;

      setDocs((currentDocs) => currentDocs.filter((doc) => doc.id !== id));
      setActiveDoc((currentId) => (currentId === id ? null : currentId));

      try {
        await deleteDocument(currentUser?.email, docToRemove.name);
        showToast(`"${docToRemove.name}" deleted successfully.`);
      } catch (error) {
        showToast(error.message || `Failed to delete ${docToRemove.name}`, "error");
      }
    },
    [docs, currentUser?.email, showToast],
  );

  const sendMessage = useCallback(
    async (text) => {
      const question = (text ?? input).trim();
      if (!question || loading || readyCount === 0) return;

      setInput("");
      setLoading(true);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "user",
          text: question,
          time: new Date(),
        },
      ]);

      try {
        const history = messages.map((msg) => ({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.text,
        }));
        const data = await askQuestion(question, currentUser?.email, history);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: crypto.randomUUID(),
            role: "ai",
            text: data.answer ?? "I could not find an answer in the uploaded documents.",
            sources: data.sources ?? [],
            time: new Date(),
            suggestions: data.suggestions ?? [],
          },
        ]);
      } catch (error) {
        showToast(error.message || "Failed to get response", "error");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, readyCount, showToast],
  );

  const handleInputChange = useCallback((event) => {
    setInput(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const handleSignOut = useCallback(() => {
    setCurrentUser(null);
    setMessages([]);
    setDocs([]);
    setInput("");
  }, []);

  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLogin={setCurrentUser}
          onSignup={() => showToast("Workspace signup is not connected yet.", "error")}
          onForgotPassword={() => showToast("Password reset is not connected yet.", "error")}
        />
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <>
      <div className="app">
        <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />

        <Sidebar
          activeDoc={activeDoc}
          docs={docs}
          dragOver={dragOver}
          onClose={() => setSidebarOpen(false)}
          onDragLeave={() => setDragOver(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDrop={handleDrop}
          onFilesSelected={handleFiles}
          onRemoveDoc={removeDoc}
          onSelectDoc={(id) => setActiveDoc((currentId) => (currentId === id ? null : id))}
          sidebarOpen={sidebarOpen}
          crawlUrl={crawlUrl}
          crawling={crawling}
          onCrawlUrlChange={setCrawlUrl}
          onCrawlSubmit={handleCrawlSubmit}
        />

        <main className="main">
          <div className="mobile-header">
            <div className="mobile-logo">
              <div className="logo-dot" />
              DocMind
            </div>
            <HeaderActions
              mobile
              messagesCount={messages.length}
              onClearChat={() => setMessages([])}
              onOpenSidebar={() => setSidebarOpen(true)}
              readyCount={readyCount}
              user={currentUser}
              onSignOut={handleSignOut}
            />
          </div>

          <div className="chat-header">
            <div>
              <div className="chat-title">AI Support Chat</div>
              <div className="chat-subtitle">
                {readyCount === 0 ? "Upload documents to begin" : `${readyCount} document${readyCount !== 1 ? "s" : ""} indexed`}
              </div>
            </div>
            <HeaderActions
              messagesCount={messages.length}
              onClearChat={() => setMessages([])}
              readyCount={readyCount}
              user={currentUser}
              onSignOut={handleSignOut}
            />
          </div>

          {hasProcessingDocs && (
            <div className="processing-bar">
              <div className="processing-fill" />
            </div>
          )}

          {messages.length === 0 ? (
            <EmptyState readyCount={readyCount} onSuggestion={sendMessage} />
          ) : (
            <Messages loading={loading} messages={messages} messagesEndRef={messagesEndRef} onSelectSuggestion={sendMessage} />
          )}

          <ChatInput
            disabled={!input.trim() || loading || readyCount === 0}
            input={input}
            loading={loading}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSend={() => sendMessage()}
            readyCount={readyCount}
          />
        </main>
      </div>

      <Toast toast={toast} />
    </>
  );
}
