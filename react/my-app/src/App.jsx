import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  SUGGESTED_QUESTIONS,
} from "./config";
import LoginPage from "./LoginPage";
import PricingPage from "./PricingPage";
import { askQuestion, uploadDocument, fetchDocuments, deleteDocument, crawlWebsite, getAllowedDomains, saveAllowedDomains } from "./services/ragApi";
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

function CreditCardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function UserDropdown({ user, onSignOut, onNavigate }) {
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
            className="user-dropdown-item"
            type="button"
            onClick={() => {
              setOpen(false);
              onNavigate("/pricing");
            }}
          >
            <CreditCardIcon />
            Pricing Plans
          </button>
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

function CodeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function EmbedModal({ isOpen, onClose, email, token }) {
  const [activeTab, setActiveTab] = useState("iframe");
  const [copied, setCopied] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [widgetKey, setWidgetKey] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  
  // Load allowed domains when modal opens
  useEffect(() => {
    if (isOpen && token) {
      getAllowedDomains(token)
        .then((res) => {
          if (res.success) {
            setAllowedDomains(res.allowed_domains || "");
            setWidgetKey(res.widget_key || "");
          }
        })
        .catch((err) => {
          console.error("Failed to load allowed domains:", err);
        });
    }
  }, [isOpen, token]);

  const handleSaveDomains = async () => {
    setSaveStatus("Saving...");
    try {
      await saveAllowedDomains(allowedDomains, token);
      setSaveStatus("Saved successfully!");
      setTimeout(() => setSaveStatus(""), 2500);
    } catch (err) {
      setSaveStatus("Failed: " + err.message);
      setTimeout(() => setSaveStatus(""), 4000);
    }
  };

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const widgetUrl = widgetKey 
    ? `${currentOrigin}/?widget=true&key=${encodeURIComponent(widgetKey)}`
    : `${currentOrigin}/?widget=true&email=${encodeURIComponent(email)}`;

  const iframeCode = `<iframe
  src="${widgetUrl}"
  width="400"
  height="600"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
></iframe>`;

  const scriptCode = `<!-- DocMind Chatbot Widget Embed -->
<script>
  (function() {
    var iframeUrl = "${widgetUrl}";
    
    var launcher = document.createElement("div");
    launcher.id = "docmind-launcher";
    launcher.style.cssText = "position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#7c6af7;box-shadow:0 4px 16px rgba(124,106,247,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:999999;transition:transform 0.2s;";
    launcher.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    
    var container = document.createElement("div");
    container.id = "docmind-container";
    container.style.cssText = "position:fixed;bottom:90px;right:20px;width:400px;height:600px;max-height:calc(100vh - 120px);border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.3);z-index:999999;overflow:hidden;display:none;border:1px solid rgba(255,255,255,0.1);";
    
    var iframe = document.createElement("iframe");
    iframe.src = iframeUrl;
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    container.appendChild(iframe);
    
    document.body.appendChild(launcher);
    document.body.appendChild(container);
    
    var isOpen = false;
    launcher.onclick = function() {
      isOpen = !isOpen;
      if (isOpen) {
        container.style.display = "block";
        launcher.style.transform = "rotate(90deg)";
        launcher.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      } else {
        container.style.display = "none";
        launcher.style.transform = "none";
        launcher.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
      }
    };
  })();
</script>`;

  const codeToCopy = activeTab === "iframe" ? iframeCode : scriptCode;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // ignore
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Embed AI Chatbot</div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon size={16} />
          </button>
        </div>
        
        <div className="modal-tabs">
          <button 
            className={`modal-tab-btn${activeTab === "iframe" ? " active" : ""}`}
            onClick={() => { setActiveTab("iframe"); setCopied(false); }}
          >
            Inline IFrame
          </button>
          <button 
            className={`modal-tab-btn${activeTab === "script" ? " active" : ""}`}
            onClick={() => { setActiveTab("script"); setCopied(false); }}
          >
            Floating Chat Bubble
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "iframe" ? (
            <p>Embed the chatbot as a permanent element inside a specific area of your webpage (e.g. your Support or Contact page):</p>
          ) : (
            <p>Add a floating support widget in the bottom-right corner of all pages on your website. Paste this code before the closing &lt;/body&gt; tag:</p>
          )}

          <div className="code-snippet-box">
            {codeToCopy}
          </div>

          <button className="modal-copy-btn" onClick={handleCopy} style={{ marginBottom: "20px" }}>
            {copied ? <CheckSmallIcon /> : <CopyIcon />}
            {copied ? "Copied!" : "Copy Code Snippet"}
          </button>

          <div className="modal-settings-group">
            <label className="modal-settings-label">Allowed Domains (CORS Lock)</label>
            <p className="modal-settings-desc">
              Protect your widget from unauthorized embeds. Enter the domains where this widget is allowed to run, separated by commas (e.g. <code>mywebsite.com, localhost</code>). Leave empty to allow all domains.
            </p>
            <div className="modal-settings-row">
              <input
                type="text"
                className="modal-settings-input"
                placeholder="e.g. mywebsite.com, localhost"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
              />
              <button className="modal-settings-save-btn" onClick={handleSaveDomains}>
                Save
              </button>
            </div>
            {saveStatus && <span className="modal-settings-status">{saveStatus}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderActions({ messagesCount, onClearChat, onOpenSidebar, readyCount, user, onSignOut, onOpenEmbed, isWidgetMode, onNavigate, mobile = false }) {
  return (
    <div className={mobile ? "mobile-actions" : "header-actions"}>
      {!isWidgetMode && <StatusBadge readyCount={readyCount} />}
      {!isWidgetMode && user && onOpenEmbed && (
        <button className="icon-btn" type="button" onClick={onOpenEmbed} aria-label="Embed widget" title="Embed widget">
          <CodeIcon />
        </button>
      )}
      {messagesCount > 0 && (
        <button className="icon-btn" type="button" onClick={onClearChat} aria-label="Clear chat" title="Clear chat">
          <TrashIcon />
        </button>
      )}
      {user && !isWidgetMode && <UserDropdown user={user} onSignOut={onSignOut} onNavigate={onNavigate} />}
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
      const params = new URLSearchParams(window.location.search);
      const isWidget = params.get("widget") === "true";
      const widgetEmail = params.get("email");
      const widgetKey = params.get("key");
      if (isWidget && (widgetEmail || widgetKey)) {
        return { 
          email: widgetEmail ? widgetEmail.trim() : null, 
          widgetKey: widgetKey ? widgetKey.trim() : null, 
          isWidget: true 
        };
      }
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
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const navigateTo = useCallback((path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  }, []);

  const isWidgetMode = currentUser?.isWidget === true;

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

  const handleSignOut = useCallback(() => {
    setCurrentUser(null);
    setMessages([]);
    setDocs([]);
    setInput("");
  }, []);

  const handleApiError = useCallback((error, defaultMsg = "An error occurred") => {
    if (error.status === 401) {
      showToast("Session expired. Please sign in again.", "error");
      handleSignOut();
    } else {
      showToast(error.message || defaultMsg, "error");
    }
  }, [handleSignOut, showToast]);

  useEffect(() => {
    if (currentUser) {
      if (!currentUser.isWidget) {
        localStorage.setItem("docmind_user", JSON.stringify(currentUser));
      }
    } else {
      localStorage.removeItem("docmind_user");
    }
  }, [currentUser]);

  const loadUserDocuments = useCallback(async () => {
    if (!currentUser?.email || currentUser.isWidget) {
      setDocs([]);
      return;
    }
    try {
      const data = await fetchDocuments(currentUser.email, currentUser.token);
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
      handleApiError(error, "Failed to load your documents from server.");
    }
  }, [currentUser?.email, currentUser?.token, handleApiError]);

  useEffect(() => {
    loadUserDocuments();
  }, [loadUserDocuments]);

  useEffect(() => {
    if (isWidgetMode && messages.length === 0) {
      setMessages([
        {
          id: "welcome-msg",
          role: "ai",
          text: "Hello! 👋 I'm your virtual support assistant. How can I help you today?",
          time: new Date(),
          suggestions: SUGGESTED_QUESTIONS,
        },
      ]);
    }
  }, [isWidgetMode, messages.length]);

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
      }, currentUser.token);

      showToast(`Website crawled successfully! Scraped ${result.pages} pages.`);
      setDocs((currentDocs) => currentDocs.filter((d) => d.id !== docId));
      await loadUserDocuments();

    } catch (error) {
      updateDoc(docId, { status: "error", progress: undefined, progressMsg: undefined });
      handleApiError(error, `Failed to crawl ${url}`);
    } finally {
      setCrawling(false);
    }
  }, [crawlUrl, crawling, currentUser?.email, currentUser?.token, loadUserDocuments, updateDoc, handleApiError]);

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
          }, currentUser.token);
          updateDoc(doc.id, {
            status: "ready",
            chunks: result.chunks ?? result.chunkCount,
            progress: undefined,
            progressMsg: undefined,
          });
          showToast(`"${file.name}" indexed successfully`);
        } catch (error) {
          updateDoc(doc.id, { status: "error", progress: undefined, progressMsg: undefined });
          handleApiError(error, `Failed to upload ${file.name}`);
        }
      }
    },
    [handleApiError, updateDoc, currentUser?.email, currentUser?.token],
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
        await deleteDocument(currentUser?.email, docToRemove.name, currentUser.token);
        showToast(`"${docToRemove.name}" deleted successfully.`);
      } catch (error) {
        handleApiError(error, `Failed to delete ${docToRemove.name}`);
      }
    },
    [docs, currentUser?.email, currentUser?.token, handleApiError],
  );

  const sendMessage = useCallback(
    async (text) => {
      const question = (text ?? input).trim();
      if (!question || loading || (!isWidgetMode && readyCount === 0)) return;

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
        const data = await askQuestion(question, currentUser?.email, history, currentUser.token, currentUser?.widgetKey);
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
        handleApiError(error, "Failed to get response");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, readyCount, handleApiError, messages, currentUser?.email, currentUser?.token, isWidgetMode],
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


  if (currentPath === "/pricing") {
    return (
      <>
        <PricingPage onBack={() => navigateTo("/")} currentUser={currentUser} />
        <Toast toast={toast} />
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginPage onLogin={setCurrentUser} onNavigate={navigateTo} />
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <>
      <div className={`app${isWidgetMode ? " widget-mode" : ""}`}>
        {!isWidgetMode && <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />}

        {!isWidgetMode && (
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
        )}

        <main className="main">
          {!isWidgetMode && (
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
                isWidgetMode={isWidgetMode}
                onNavigate={navigateTo}
              />
            </div>
          )}

          <div className="chat-header">
            {isWidgetMode ? (
              <div>
                <div className="chat-title">AI Support Assistant</div>
                <div className="chat-subtitle">
                  <span className="widget-status-dot" /> Online & ready
                </div>
              </div>
            ) : (
              <div>
                <div className="chat-title">AI Support Chat</div>
                <div className="chat-subtitle">
                  {readyCount === 0 ? "Upload documents to begin" : `${readyCount} document${readyCount !== 1 ? "s" : ""} indexed`}
                </div>
              </div>
            )}
            
            {isWidgetMode ? (
              messages.length > 1 && (
                <button className="icon-btn" type="button" onClick={() => setMessages([])} aria-label="Clear chat" title="Clear chat">
                  <TrashIcon />
                </button>
              )
            ) : (
              <HeaderActions
                messagesCount={messages.length}
                onClearChat={() => setMessages([])}
                readyCount={readyCount}
                user={currentUser}
                onSignOut={handleSignOut}
                onOpenEmbed={() => setEmbedModalOpen(true)}
                isWidgetMode={isWidgetMode}
                onNavigate={navigateTo}
              />
            )}
          </div>

          {hasProcessingDocs && !isWidgetMode && (
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
            disabled={(!isWidgetMode && readyCount === 0) || loading}
            input={input}
            loading={loading}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSend={() => sendMessage()}
            readyCount={isWidgetMode ? 1 : readyCount}
          />
        </main>
      </div>

      {!isWidgetMode && (
        <EmbedModal 
          isOpen={embedModalOpen} 
          onClose={() => setEmbedModalOpen(false)} 
          email={currentUser?.email} 
          token={currentUser?.token}
        />
      )}

      <Toast toast={toast} />
    </>
  );
}
