import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Seja bem-vindo à SP Assessoria de Recursos Administrativos. Sou o seu assistente virtual especializado em recursos extrajudiciais. Como posso lhe ajudar hoje?",
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessageBadge, setHasNewMessageBadge] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasNewMessageBadge(false);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const updatedMessages = [...messages, userMsg];
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        throw new Error("Resposta do servidor não foi amigável");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
    } catch (error) {
      console.error("Erro na comunicação com a IA:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Peço desculpas, mas encontrei uma instabilidade de conexão no momento. Se preferir um atendimento imediato com nossos especialistas humanos, por favor fale conosco pelo WhatsApp: (11) 98704-9051.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start">
      {/* Chat bubble toggle button */}
      {!isOpen && (
        <button
          id="chat-bubble-toggle-btn"
          onClick={() => setIsOpen(true)}
          className="relative p-4 bg-brand-navy-900 border border-brand-gold-500/20 text-white rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 hover:bg-brand-navy-800 active:scale-95 group focus:outline-hidden cursor-pointer"
          aria-label="Abrir assistente virtual"
        >
          {hasNewMessageBadge && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-gold-500 text-[10px] font-bold text-brand-navy-950 items-center justify-center">
                !
              </span>
            </span>
          )}
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div 
          id="chat-window"
          className="w-80 md:w-96 h-[500px] bg-white border border-gray-150 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up animate-duration-300"
        >
          {/* Header */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-gold-500/10 border border-brand-gold-500/20 rounded-full flex items-center justify-center text-brand-gold-600">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-navy-900 font-display">Assistente SP Assessoria</h4>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-gray-500 font-medium">Atendimento Virtual IA</span>
                </div>
              </div>
            </div>
            <button 
              id="close-chat-widget-btn"
              onClick={() => setIsOpen(false)} 
              className="text-gray-400 hover:text-brand-navy-900 transition-colors p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Legal Notice Warning */}
          <div className="p-2.5 bg-[#f4f6f8] border-b border-gray-100 text-[10px] text-gray-500 flex items-start gap-1.5 leading-normal">
            <AlertCircle className="w-3.5 h-3.5 text-brand-gold-600 shrink-0 mt-0.5" />
            <span className="font-medium">
              <strong>Nota:</strong> Atuação 100% administrativa e extrajudicial. Sem atividades exclusivas da advocacia.
            </span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed shadow-xs ${
                    m.role === "user"
                      ? "bg-brand-navy-900 text-white font-semibold rounded-tr-none"
                      : "bg-[#f4f6f8] border border-gray-150 text-gray-700 rounded-tl-none whitespace-pre-wrap"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-1.5 p-2 bg-[#f4f6f8] border border-gray-150 rounded-lg rounded-tl-none w-20 text-center justify-center">
                <div className="w-1.5 h-1.5 bg-brand-gold-600 rounded-full animate-bounce delay-100" />
                <div className="w-1.5 h-1.5 bg-brand-gold-600 rounded-full animate-bounce delay-200" />
                <div className="w-1.5 h-1.5 bg-brand-gold-600 rounded-full animate-bounce delay-300" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat suggestions chips */}
          {messages.length === 1 && (
            <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
              <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider block">Dúvidas Frequentes:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleSuggestionClick("Como recorrer multa de trânsito?")}
                  className="px-2 py-1 bg-white border border-gray-250 hover:border-brand-gold-500/20 text-gray-600 hover:text-brand-navy-900 rounded-md text-[10px] font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Recurso de Multa 🚗
                </button>
                <button
                  onClick={() => handleSuggestionClick("Como dar entrada no BPC/LOAS?")}
                  className="px-2 py-1 bg-white border border-gray-250 hover:border-brand-gold-500/20 text-gray-600 hover:text-brand-navy-900 rounded-md text-[10px] font-semibold transition-all cursor-pointer shadow-xs"
                >
                  BPC / LOAS 📑
                </button>
                <button
                  onClick={() => handleSuggestionClick("Vocês são advogados?")}
                  className="px-2 py-1 bg-white border border-gray-250 hover:border-brand-gold-500/20 text-gray-600 hover:text-brand-navy-900 rounded-md text-[10px] font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Quem são vocês? ⚖️
                </button>
              </div>
            </div>
          )}

          {/* Chat input form */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage();
              }}
              placeholder="Digite sua dúvida aqui..."
              disabled={isLoading}
              className="flex-1 bg-white border border-gray-250 focus:border-brand-gold-500 focus:outline-hidden rounded-lg px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 disabled:opacity-50"
            />
            <button
              id="send-chat-msg-btn"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputText.trim()}
              className="p-2 bg-brand-navy-900 hover:bg-brand-navy-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
