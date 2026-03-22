"use client";

import { useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [messages, setMessages] = useState<{ from: "bot" | "user"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const confirmEmail = () => {
    if (!email.trim() || !email.includes("@")) return;
    setEmailConfirmed(true);
    setMessages([
      { from: "bot", text: `Salut ! 👋 Bienvenue chez Cartoonova ! Comment puis-je vous aider ?` },
    ]);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { from: "user", text: userMsg }]);
    setInput("");
    setSending(true);

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message: userMsg }),
      });
    } catch {
      // silent fail
    }

    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Merci pour votre message ! 📩 Notre équipe vous répondra très vite par email. À bientôt ! 😊" },
      ]);
      setSending(false);
    }, 800);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Chat window */}
      <div className={`pointer-events-auto transition-all duration-300 origin-bottom-right ${open ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}>
        <div className="w-[280px] sm:w-[380px] bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-yellow-400 border-b-4 border-black px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                🎨
              </div>
              <div>
                <p className="font-black text-black text-sm uppercase">Cartoonova</p>
                <p className="text-xs font-bold text-black/60 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  En ligne
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center font-black text-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>

          {!emailConfirmed ? (
            /* Email gate */
            <div className="p-6 flex flex-col items-center gap-4 bg-yellow-50">
              <div className="w-16 h-16 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                💬
              </div>
              <p className="font-black text-black text-center uppercase text-sm">Avant de commencer, entrez votre email !</p>
              <p className="text-xs font-bold text-black/50 text-center">Pour que notre équipe puisse vous répondre.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmEmail()}
                placeholder="votre@email.com"
                className="w-full px-4 py-3 text-sm font-bold bg-white border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-black/30 text-center"
              />
              <button
                onClick={confirmEmail}
                className="w-full bg-yellow-400 text-black font-black text-sm uppercase px-6 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                Démarrer le chat 🚀
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 max-h-[320px] overflow-y-auto p-4 flex flex-col gap-3 bg-yellow-50">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-sm font-bold leading-relaxed ${
                        m.from === "user"
                          ? "bg-yellow-400 text-black border-2 border-black rounded-2xl rounded-br-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white text-black border-2 border-black rounded-2xl rounded-bl-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white text-black/40 border-2 border-black rounded-2xl rounded-bl-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-4 py-2.5 text-sm font-black">
                      ● ● ●
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t-4 border-black p-3 bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Écrivez votre message..."
                  className="flex-1 min-w-0 px-4 py-2.5 text-sm font-bold bg-yellow-50 border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-black/30"
                />
                <button
                  onClick={send}
                  disabled={sending}
                  className="w-10 h-10 rounded-xl bg-yellow-400 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-black flex items-center justify-center text-xl sm:text-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer ${open ? "bg-white" : "bg-yellow-400 animate-bounce"}`}
        aria-label="Ouvrir le chat"
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
