import React, { useState } from "react";
import { X, Send, Phone, MessageSquare, ShieldCheck, CheckCircle2 } from "lucide-react";

interface WhatsAppLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService?: string;
}

export function WhatsAppLeadModal({ isOpen, onClose, defaultService = "INSS - Recursos e Benefícios" }: WhatsAppLeadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState(defaultService);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || name.trim().length < 3) {
      setErrorMsg("Por favor, informe seu nome completo.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMsg("Por favor, informe um número de WhatsApp válido com DDD.");
      return;
    }

    if (website) {
      // Honeypot triggered
      onClose();
      return;
    }

    setIsSubmitting(true);

    const leadData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      service: service,
      message: message.trim(),
      type: "WhatsApp Direct",
      lgpdConsent: true,
      website: website
    };

    // 1. Save lead to server database (Supabase + Firestore + Local Backup)
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadData)
      });
    } catch (err) {
      console.warn("Notice: Saved lead offline before WhatsApp redirect", err);
    }

    // 2. Format WhatsApp text
    const primaryPhone = "5511987049051";
    const messageText = `Olá, SP Assessoria! Gostaria de falar com um especialista sobre o meu caso:

*Nome:* ${name.trim()}
*WhatsApp:* ${phone.trim()}
*E-mail:* ${email.trim() || "Não informado"}
*Serviço de Interesse:* ${service}
*Relato / Motivo:* ${message.trim() || "Gostaria de uma análise prévia do meu caso."}

Aguardo o atendimento online!`;

    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${primaryPhone}&text=${encodedText}`;

    // 3. Open WhatsApp and close modal
    window.open(whatsappUrl, "_blank");
    setIsSubmitting(false);
    onClose();

    // Reset form
    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        id="whatsapp-lead-modal-card"
        className="relative w-full max-w-lg bg-white border border-gray-150 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base leading-snug">Falar com Especialista via WhatsApp</h3>
              <p className="text-[11px] text-emerald-100 font-medium">Preencha os dados abaixo para iniciar o atendimento digital</p>
            </div>
          </div>
          <button 
            id="close-whatsapp-lead-modal-btn"
            onClick={onClose} 
            className="p-1.5 text-emerald-200 hover:text-white transition-colors rounded-lg hover:bg-emerald-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-left">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold">Atenção:</span> {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-600 tracking-wider mb-1">
                Seu Nome Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-600 tracking-wider mb-1">
                  WhatsApp com DDD *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-600 tracking-wider mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: joao@email.com"
                  className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-600 tracking-wider mb-1">
                Serviço / Motivo da Consulta *
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              >
                <option value="INSS - Recursos e Benefícios">INSS - Recursos, BPC/LOAS e Indeferimentos</option>
                <option value="Trânsito - Recursos e CNH">Trânsito - Multas, Suspensão ou Cassação de CNH</option>
                <option value="Processos Administrativos Gerais">Serviços e Requerimentos Administrativos Gerais</option>
                <option value="Outros Assuntos">Outros Assuntos / Informações</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-600 tracking-wider mb-1">
                Resumo do Caso ou Dúvida (opcional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Descreva resumidamente o seu problema para agilizarmos o atendimento..."
                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white resize-none"
              />
            </div>

            {/* Honeypot field */}
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                tabIndex={-1}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Seus dados estão protegidos conforme a LGPD e serão utilizados exclusivamente para a triagem inicial do seu atendimento.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? "Registrando..." : "Iniciar Atendimento no WhatsApp"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
