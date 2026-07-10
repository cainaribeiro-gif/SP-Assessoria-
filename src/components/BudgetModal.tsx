import React, { useState } from "react";
import { X, Calculator, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded?: (lead: any) => void;
}

const SERVICES_CONFIG = {
  inss: {
    label: "INSS & Previdenciário",
    options: [
      { id: "bpc_loas", label: "BPC/LOAS (Benefício de Prestação Continuada)", basePrice: "R$ 600 - R$ 1.200", docs: ["RG/CPF", "Cadastro Único atualizado", "Laudos médicos (se PCD)", "Comprovante de renda familiar"] },
      { id: "recurso_inss", label: "Recursos em Benefícios Indeferidos", basePrice: "R$ 500 - R$ 900", docs: ["Carta de indeferimento do INSS", "Cópia do processo administrativo", "Laudos ou documentos adicionais"] },
      { id: "revisoes", label: "Revisão de Aposentadoria / Benefício", basePrice: "R$ 700 - R$ 1.500", docs: ["Carta de concessão", "Extrato CNIS", "Memória de cálculo do benefício"] },
      { id: "exigencias", label: "Cumprimento de Exigências", basePrice: "R$ 250 - R$ 400", docs: ["Notificação de exigência", "Documentos solicitados pelo INSS"] },
    ]
  },
  transito: {
    label: "Trânsito & CNH",
    options: [
      { id: "recurso_multa", label: "Recurso de Multas Gravíssimas ou Estouradas", basePrice: "R$ 150 - R$ 350", docs: ["Notificação de autuação ou penalidade", "Cópia da CNH", "Documento do veículo (CRLV)"] },
      { id: "suspensao", label: "Processo de Suspensão do Direito de Dirigir", basePrice: "R$ 450 - R$ 850", docs: ["Notificação de instauração do processo", "Histórico de pontuação da CNH", "Cópia da CNH"] },
      { id: "cassacao", label: "Processo de Cassação da CNH", basePrice: "R$ 600 - R$ 1.100", docs: ["Notificação de cassação", "Cópia da CNH", "Notificações anteriores relacionadas"] },
    ]
  },
  administrativo: {
    label: "Serviços Administrativos Gerais",
    options: [
      { id: "requerimentos", label: "Elaboração de Requerimentos & Defesas Gerais", basePrice: "R$ 200 - R$ 500", docs: ["Documentos pessoais", "Relato detalhado da situação", "Cópia de notificação (se houver)"] },
      { id: "consultoria", label: "Análise Documental & Consultoria", basePrice: "R$ 150 - R$ 300", docs: ["Todos os documentos relevantes para a análise"] },
    ]
  }
};

export function BudgetModal({ isOpen, onClose, onLeadAdded }: BudgetModalProps) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<"inss" | "transito" | "administrativo" | "">("");
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleCategorySelect = (cat: "inss" | "transito" | "administrativo") => {
    setCategory(cat);
    setServiceId("");
    setStep(2);
  };

  const handleServiceSelect = (id: string) => {
    setServiceId(id);
    setStep(3);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !whatsapp) return;
    
    const selectedService = getSelectedServiceDetails();
    const leadData = {
      id: `lead-${Date.now()}`,
      name,
      phone: whatsapp,
      service: selectedService?.label || "Orçamento",
      message: description || `Simulador de Orçamento: ${selectedService?.label}. Estimativa base: ${selectedService?.basePrice}`,
      type: "Orçamento",
      status: "Novo",
      date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    };

    // Callback to save locally
    if (onLeadAdded) {
      onLeadAdded(leadData);
    } else {
      const saved = localStorage.getItem("sp_site_data");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.leads = [leadData, ...(parsed.leads || [])];
          localStorage.setItem("sp_site_data", JSON.stringify(parsed));
        } catch (err) {
          console.warn(err);
        }
      }
    }

    // Submit lead to our database API
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadData)
    }).catch(err => console.warn("Erro ao enviar lead:", err));

    setStep(4);
  };

  const getSelectedServiceDetails = () => {
    if (!category || !serviceId) return null;
    return SERVICES_CONFIG[category].options.find(opt => opt.id === serviceId);
  };

  const selectedService = getSelectedServiceDetails();

  const handleSendToWhatsApp = () => {
    if (!selectedService) return;
    
    const phones = ["5511987049051", "5511993344293"];
    const phone = phones[0];

    const messageText = `Olá, SP Assessoria! Gostaria de um orçamento formal baseado no simulador do site:
    
*Cliente:* ${name}
*WhatsApp:* ${whatsapp}
*Categoria:* ${SERVICES_CONFIG[category as keyof typeof SERVICES_CONFIG]?.label}
*Serviço:* ${selectedService.label}
*Descrição do Caso:* ${description || "Não informada."}
*Estimativa Preliminar:* ${selectedService.basePrice}

Tenho interesse em agilizar o meu protocolo administrativo. Como podemos prosseguir?`;

    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
    
    window.open(whatsappUrl, "_blank");
    onClose();
    setStep(1);
    setCategory("");
    setServiceId("");
    setName("");
    setWhatsapp("");
    setDescription("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        id="budget-modal-card"
        className="relative w-full max-w-lg bg-white border border-gray-150 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-gold-600" />
            <span className="font-display font-bold text-brand-navy-900 text-lg">Solicitar Orçamento</span>
          </div>
          <button 
            id="close-budget-modal-btn"
            onClick={() => {
              onClose();
              setStep(1);
            }} 
            className="text-gray-400 hover:text-brand-navy-900 transition-colors cursor-pointer rounded p-1 hover:bg-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-[#f4f6f8] px-5 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
          <span>Passo {step} de 4</span>
          <div className="flex gap-1">
            <div className={`w-3 h-1.5 rounded-full transition-all ${step >= 1 ? "bg-brand-gold-600" : "bg-gray-200"}`} />
            <div className={`w-3 h-1.5 rounded-full transition-all ${step >= 2 ? "bg-brand-gold-600" : "bg-gray-200"}`} />
            <div className={`w-3 h-1.5 rounded-full transition-all ${step >= 3 ? "bg-brand-gold-600" : "bg-gray-200"}`} />
            <div className={`w-3 h-1.5 rounded-full transition-all ${step >= 4 ? "bg-brand-gold-600" : "bg-gray-200"}`} />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm sm:text-base font-display font-bold text-brand-navy-900 mb-2 text-center">
                Selecione a área do seu problema administrativo
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <button
                  id="select-category-inss"
                  onClick={() => handleCategorySelect("inss")}
                  className="p-4 bg-gray-50 border border-gray-200 hover:border-brand-gold-500/30 rounded-xl text-left text-brand-navy-900 font-bold hover:bg-white hover:shadow-xs transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <span className="block text-brand-navy-900 group-hover:text-brand-gold-700 transition-colors">INSS & Previdenciário</span>
                    <span className="text-xs text-gray-500 font-normal">BPC/LOAS, Recursos de indeferimentos, etc.</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-brand-gold-600 transition-opacity" />
                </button>

                <button
                  id="select-category-transito"
                  onClick={() => handleCategorySelect("transito")}
                  className="p-4 bg-gray-50 border border-gray-200 hover:border-brand-gold-500/30 rounded-xl text-left text-brand-navy-900 font-bold hover:bg-white hover:shadow-xs transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <span className="block text-brand-navy-900 group-hover:text-brand-gold-700 transition-colors">Infrações de Trânsito</span>
                    <span className="text-xs text-gray-500 font-normal">Recurso de multas, suspensão ou cassação de CNH.</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-brand-gold-600 transition-opacity" />
                </button>

                <button
                  id="select-category-admin"
                  onClick={() => handleCategorySelect("administrativo")}
                  className="p-4 bg-gray-50 border border-gray-200 hover:border-brand-gold-500/30 rounded-xl text-left text-brand-navy-900 font-bold hover:bg-white hover:shadow-xs transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <span className="block text-brand-navy-900 group-hover:text-brand-gold-700 transition-colors">Serviços Administrativos Gerais</span>
                    <span className="text-xs text-gray-500 font-normal">Análises de documentos, elaboração de requerimentos.</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-brand-gold-600 transition-opacity" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && category && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <button 
                  onClick={() => setStep(1)} 
                  className="text-xs text-brand-gold-600 hover:underline cursor-pointer font-bold"
                >
                  ← Voltar
                </button>
                <span className="text-xs text-gray-500 uppercase font-bold">
                  {SERVICES_CONFIG[category].label}
                </span>
              </div>
              <h3 className="text-base font-display font-bold text-brand-navy-900 mb-3">
                Qual serviço melhor se enquadra na sua necessidade?
              </h3>
              <div className="space-y-2">
                {SERVICES_CONFIG[category].options.map((opt) => (
                  <button
                    key={opt.id}
                    id={`select-service-${opt.id}`}
                    onClick={() => handleServiceSelect(opt.id)}
                    className="w-full p-3 bg-white hover:bg-gray-50 border border-gray-150 hover:border-brand-gold-500/20 rounded-lg text-left text-sm text-brand-navy-900 font-semibold transition-all flex items-center justify-between group cursor-pointer shadow-xs"
                  >
                    <span>{opt.label}</span>
                    <ChevronRight className="w-4 h-4 text-brand-gold-600 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && selectedService && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <button 
                  type="button" 
                  onClick={() => setStep(2)} 
                  className="text-xs text-brand-gold-600 hover:underline font-bold cursor-pointer"
                >
                  ← Voltar
                </button>
                <span className="text-xs text-gray-500 font-bold truncate max-w-[200px]">
                  {selectedService.label}
                </span>
              </div>
              
              <h3 className="text-base font-display font-bold text-brand-navy-900 mb-1">
                Por favor, informe seus dados de contato
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Estes dados serão anexados à sua consulta para que possamos prestar uma pré-análise transparente.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-gray-50 border border-gray-250 text-gray-800 placeholder-gray-400 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:border-brand-gold-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                  Seu WhatsApp / Telefone *
                </label>
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  className="w-full bg-gray-50 border border-gray-250 text-gray-800 placeholder-gray-400 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:border-brand-gold-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                  Descrição do seu caso (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Conte brevemente o ocorrido (ex: recebi uma multa indevida, meu BPC foi negado...)"
                  className="w-full bg-gray-50 border border-gray-250 text-gray-800 placeholder-gray-400 rounded-lg px-4 py-2 text-sm focus:outline-hidden focus:border-brand-gold-500 focus:bg-white transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                id="submit-budget-step3-btn"
                className="w-full mt-2 py-3 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Calcular Estimativa</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 4 && selectedService && (
            <div className="space-y-5 text-center">
              <div className="mx-auto w-12 h-12 bg-brand-gold-500/10 border border-brand-gold-500/20 rounded-full flex items-center justify-center text-brand-gold-600">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-brand-gold-600">Estimativa Gerada</span>
                <h3 className="text-xl font-display font-bold text-brand-navy-900 mt-1">Análise Preliminar Completa</h3>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl text-left space-y-3">
                <div>
                  <span className="text-[10px] text-gray-500 block font-bold">SERVIÇO SELECIONADO</span>
                  <span className="text-sm text-brand-navy-900 font-bold">{selectedService.label}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-2">
                  <div>
                    <span className="text-[10px] text-gray-500 block font-bold">VALOR ESTIMADO</span>
                    <span className="text-sm font-extrabold text-brand-gold-700">{selectedService.basePrice}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block font-bold">PRAZO ESTIMADO</span>
                    <span className="text-sm text-brand-navy-900 font-bold">2 a 5 dias úteis</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-2">
                  <span className="text-[10px] text-gray-500 block font-bold mb-1">DOCUMENTOS NECESSÁRIOS</span>
                  <ul className="text-xs text-gray-600 space-y-1 list-inside list-disc font-medium">
                    {selectedService.docs.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="text-[10px] text-gray-500 text-left italic leading-relaxed">
                * Os valores acima são uma estimativa de honorários administrativos base. O preço final será fixado em proposta formal após auditoria minuciosa da documentação. Não realizamos serviços de advocacia judicial.
              </p>

              <button
                id="send-budget-whatsapp-btn"
                onClick={handleSendToWhatsApp}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
              >
                <span>Enviar Orçamento para WhatsApp</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
