import { useEffect, useRef, useState } from "react";

const CHAT_ENDPOINT =
  import.meta.env.PUBLIC_CHAT_ENDPOINT ||
  "https://bfcfkgskoofforjgqnem.functions.supabase.co/chat";

const initialMessage = {
  role: "assistant",
  content: "Hey! I can answer questions about Sampreeth — projects, experience, filmmaking, or background. Ask me anything about him.",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    const interval = setInterval(() => {
      setShowNudge(true);
      setTimeout(() => setShowNudge(false), 3000);
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError("");

    if (!CHAT_ENDPOINT) {
      setError("Chat endpoint is not configured yet.");
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
        className={`fixed right-4 bottom-28 lg:right-8 lg:bottom-32 z-50 w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-primary text-secondary border border-secondary dark:bg-dk-primary dark:text-dk-secondary dark:border-dk-secondary shadow-lg transition chat-attention ${
          isOpen ? "hidden" : ""
        }`}
        aria-label="Open chatbot"
        onClick={() => setIsOpen(true)}
      >
        <img
          src="/logos/samp-chat.png"
          alt="Samp-chat avatar"
          className="absolute -left-12 -bottom-2 w-10 h-10 rounded-full border border-secondary/50 dark:border-dk-secondary/50 shadow-md bg-primary dark:bg-dk-primary"
        />
        {showNudge && (
          <div className="absolute -left-44 -top-8 lg:-top-10">
            <div className="bg-secondary text-primary px-3 py-2 rounded-full text-xs lg:text-sm shadow-lg animate-fade-in-out whitespace-nowrap">
              Ask anything about Sampreeth
            </div>
          </div>
        )}
        <i className="fas fa-comment-dots text-2xl lg:text-3xl"></i>
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 lg:w-4.5 lg:h-4.5 bg-red-500 rounded-full ring-2 ring-primary dark:ring-dk-primary"></span>
      </button>

      {isOpen && (
        <div className="fixed right-4 bottom-28 lg:right-8 lg:bottom-32 z-50 w-[320px] lg:w-[360px] bg-primary dark:bg-dk-primary border border-secondary/30 dark:border-dk-secondary/30 rounded-xl shadow-2xl flex flex-col">
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
            className="flex-1 px-4 py-3 space-y-3 overflow-y-auto max-h-[380px]"
          >
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-secondary text-primary ml-6"
                    : "bg-secondary/10 text-text dark:text-dk-text mr-6"
                }`}
              >
                {msg.content}
              </div>
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
