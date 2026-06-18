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
        className={`fixed right-4 bottom-28 lg:right-8 lg:bottom-32 z-50 rounded-full bg-primary text-secondary border border-secondary dark:bg-dk-primary dark:text-dk-secondary dark:border-dk-secondary shadow-lg transition-all duration-300 ease-out ${
          isOpen ? "hidden" : ""
        } ${
          compact
            ? "w-11 h-11 lg:w-12 lg:h-12 opacity-80 hover:opacity-100 hover:scale-105"
            : "w-14 h-14 lg:w-16 lg:h-16 chat-attention"
        }`}
        aria-label="Open chatbot"
        onClick={() => setIsOpen(true)}
      >
        <img
          src="/logos/samp-chat.png"
          alt="Samp-chat avatar"
          className={`absolute -left-12 -bottom-2 w-10 h-10 rounded-full border border-secondary/50 dark:border-dk-secondary/50 shadow-md bg-primary dark:bg-dk-primary transition-all duration-300 ${
            compact ? "opacity-0 scale-50 pointer-events-none" : "opacity-100 scale-100"
          }`}
        />
        {showNudge && !compact && (
          <div className="absolute -left-44 -top-8 lg:-top-10">
            <div className="bg-secondary text-primary px-3 py-2 rounded-full text-xs lg:text-sm shadow-lg animate-fade-in-out whitespace-nowrap">
              Ask anything about Sampreeth
            </div>
          </div>
        )}
        <i className={`fas fa-comment-dots transition-all duration-300 ${compact ? "text-lg lg:text-xl" : "text-2xl lg:text-3xl"}`}></i>
        <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 lg:w-4.5 lg:h-4.5 bg-red-500 rounded-full ring-2 ring-primary dark:ring-dk-primary transition-opacity duration-300 ${compact ? "opacity-0" : "opacity-100"}`}></span>
      </button>

      {isOpen && (
        <div className="fixed right-4 bottom-28 lg:right-8 lg:bottom-32 z-50 w-[calc(100vw-2rem)] sm:w-[400px] lg:w-[440px] xl:w-[480px] bg-primary dark:bg-dk-primary border border-secondary/30 dark:border-dk-secondary/30 rounded-xl shadow-2xl flex flex-col max-h-[min(80vh,720px)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary/20 dark:border-dk-secondary/20">
            <div>
              <p className="text-sm font-semibold text-secondary dark:text-dk-secondary">Ask Sampreeth</p>
              <p className="text-xs text-text dark:text-dk-text">Friendly, short, and to the point.</p>
            </div>
            <img
              src="/logos/samp-chat.png"
              alt="Samp-chat avatar"
              className="w-16 h-16 rounded-full border border-secondary/40 dark:border-dk-secondary/40"
            />
            <button
              className="text-secondary dark:text-dk-secondary hover:text-accent dark:hover:text-dk-accent"
              aria-label="Close chatbot"
              onClick={() => setIsOpen(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 px-4 py-3 space-y-3 overflow-y-auto"
          >
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-secondary text-primary ml-8"
                    : "chat-msg-rich bg-secondary/10 text-text dark:text-dk-text mr-4"
                }`}
                {...(msg.role === "assistant"
                  ? { dangerouslySetInnerHTML: { __html: renderRich(msg.content) } }
                  : { children: msg.content })}
              />
            ))}
            {isLoading && (
              <div className="text-xs text-text dark:text-dk-text">Typing…</div>
            )}
            {error && (
              <div className="text-xs text-red-500">{error}</div>
            )}
          </div>

          <div className="border-t border-secondary/20 dark:border-dk-secondary/20 px-3 py-3">
            <div className="flex items-center gap-2">
              <textarea
                className="flex-1 resize-none rounded-lg border border-secondary/30 dark:border-dk-secondary/30 bg-primary dark:bg-dk-primary px-3 py-2 text-sm text-text dark:text-dk-text focus:outline-none"
                rows={2}
                placeholder="Ask about Sampreeth…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="px-3 py-2 rounded-lg bg-secondary text-primary text-sm font-semibold hover:bg-accent transition"
                onClick={sendMessage}
                disabled={isLoading}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
