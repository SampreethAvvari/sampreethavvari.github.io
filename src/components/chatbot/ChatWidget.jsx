import { useEffect, useRef, useState } from "react";

// Set PUBLIC_CHAT_ENDPOINT in the build env to point at the deployed Cloudflare
// Worker (e.g. https://sampreeth-chatbot.<subdomain>.workers.dev/chat).
// See chatbot-worker/README.md for the one-time setup.
const CHAT_ENDPOINT = import.meta.env.PUBLIC_CHAT_ENDPOINT || "";

const initialMessage = {
  role: "assistant",
  content: "Hey! Ask me anything about Sampreeth. Projects, experience, filmmaking, background.",
};

// Tiny safe renderer for the four markdown shapes the system prompt asks the
// model to emit: **bold**, [text](url), '- ' bullet lists, and paragraph
// breaks. Everything is HTML-escaped before any markdown transform runs, so
// the model can never inject tags. URLs are whitelisted to http(s)/mailto/
// in-site paths — anything else falls back to '#'.
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeUrl(url) {
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^[/#]/.test(url)) return url;
  return "#";
}

function applyInline(s) {
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const safe = safeUrl(url);
    const external = /^https?:/i.test(safe);
    const attrs = external ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${safe}"${attrs}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}

function renderRich(content) {
  const escaped = escapeHtml(content);
  const paragraphs = escaped.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length === 0) return "";
      if (lines.every((l) => /^-\s/.test(l.trim()))) {
        const items = lines
          .map((l) => `<li>${applyInline(l.trim().replace(/^-\s*/, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
        const items = lines
          .map((l) => `<li>${applyInline(l.trim().replace(/^\d+\.\s*/, ""))}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      return `<p>${applyInline(lines.join("<br/>"))}</p>`;
    })
    .join("");
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen || compact) return;
    const interval = setInterval(() => {
      setShowNudge(true);
      setTimeout(() => setShowNudge(false), 3000);
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen, compact]);

  // Shrink the launcher into a quiet, compact circle once the visitor scrolls
  // past the hero, so it stops occupying the screen while they read. It pops
  // back to full size at the top — and a tap always opens the full chat.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError("");

    if (!CHAT_ENDPOINT) {
      setError("Chat is offline while the new worker is being deployed. Email me at spa9659@nyu.edu in the meantime.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const data = await res.json();
      const reply = data.reply || "Sorry, I don't have that info yet.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Sorry, something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        className={`chat-launcher fixed right-4 bottom-24 lg:right-7 lg:bottom-28 z-50 rounded-full transition-all duration-300 ease-out ${
          isOpen ? "hidden" : "inline-flex"
        } ${
          compact
            ? "w-12 h-12 opacity-90 hover:opacity-100"
            : "w-14 h-14 lg:w-16 lg:h-16 chat-attention"
        }`}
        aria-label="Open chat"
        onClick={() => setIsOpen(true)}
      >
        <img
          src="/logos/samp-chat.png"
          alt="Chat with Sampreeth's assistant"
          className="w-full h-full rounded-full object-cover p-[3px]"
        />
        <span className="chat-online-dot" aria-hidden="true"></span>
        {showNudge && !compact && (
          <span className="chat-nudge animate-fade-in-out">Ask me anything about Sampreeth</span>
        )}
      </button>

      {isOpen && (
        <div className="chat-panel fixed right-4 bottom-24 lg:right-7 lg:bottom-28 z-50 w-[calc(100vw-2rem)] sm:w-[392px] flex flex-col max-h-[min(78vh,640px)]">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-text/10 dark:border-dk-text/10">
            <span className="relative shrink-0">
              <img
                src="/logos/samp-chat.png"
                alt=""
                className="w-9 h-9 rounded-full object-cover ring-1 ring-text/15 dark:ring-dk-text/20"
              />
              <span className="chat-online-dot" aria-hidden="true"></span>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text dark:text-dk-text leading-tight">Ask Sampreeth</p>
              <p className="text-[0.7rem] text-text/55 dark:text-dk-text/55 leading-tight">Usually answers in a sentence or two</p>
            </div>
            <button
              className="chat-icon-btn"
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
            >
              <i className="fas fa-xmark"></i>
            </button>
          </div>

          <div ref={scrollRef} className="chat-scroll flex-1 px-4 py-4 space-y-3 overflow-y-auto">
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[0.86rem] leading-relaxed ${
                  msg.role === "user"
                    ? "ml-auto chat-bubble-user"
                    : "chat-bubble-bot chat-msg-rich"
                }`}
                {...(msg.role === "assistant"
                  ? { dangerouslySetInnerHTML: { __html: renderRich(msg.content) } }
                  : { children: msg.content })}
              />
            ))}
            {isLoading && (
              <div className="chat-bubble-bot rounded-2xl px-3.5 py-3 w-fit">
                <span className="chat-typing" aria-label="Typing">
                  <i></i><i></i><i></i>
                </span>
              </div>
            )}
            {error && <div className="text-xs text-rose-500 px-1">{error}</div>}
          </div>

          <div className="p-3 border-t border-text/10 dark:border-dk-text/10">
            <div className="chat-composer">
              <textarea
                className="chat-input"
                rows={1}
                placeholder="Ask about Sampreeth…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="chat-send"
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
              >
                <i className="fas fa-arrow-up"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
