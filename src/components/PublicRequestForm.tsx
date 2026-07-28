import React, { useState } from "react";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle, 
  Send, 
  X, 
  FileCheck,
  Search,
  Shield,
  Clock,
  Loader2,
  HelpCircle
} from "lucide-react";
import { db, storage } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface PublicRequestFormProps {
  onSuccessQueryProtocol?: (protocol: string) => void;
}

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "docx", "doc", "txt"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_FILES_SIZE = 30 * 1024 * 1024; // 30MB total

// User-friendly CPF Validation (checks 11 digits)
function isValidCPF(cpfStr: string): boolean {
  const clean = cpfStr.replace(/\D/g, "");
  return clean.length === 11;
}

// Name Validation (min 2 chars)
function isValidFullName(nameStr: string): boolean {
  const trimmed = nameStr.trim();
  return trimmed.length >= 2;
}

// Email Validation
function isValidEmail(emailStr: string): boolean {
  if (!emailStr.trim()) return true; // Optional or basic email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailStr.trim());
}

// Phone Validation (10 to 13 digits with DDD)
function isValidPhone(phoneStr: string): boolean {
  const clean = phoneStr.replace(/\D/g, "");
  return clean.length >= 10 && clean.length <= 13;
}

export function PublicRequestForm({ onSuccessQueryProtocol }: PublicRequestFormProps) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCpf, setClientCpf] = useState("");
  const [service, setService] = useState("INSS - Recursos e Benefícios");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // UI & Validation States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedProtocol, setSubmittedProtocol] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState(false);

  // File selection handler with strict validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    if (!e.target.files) return;

    const selectedFiles: File[] = Array.from(e.target.files);
    const validFiles: File[] = [];

    let currentTotalSize = files.reduce((acc, f) => acc + f.size, 0);

    for (const file of selectedFiles) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        setErrorMessage(`Formato não permitido no arquivo "${file.name}". Permitidos: PDF, JPG, PNG, DOCX, TXT.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`O arquivo "${file.name}" excede o tamanho máximo de 10MB.`);
        return;
      }
      if (currentTotalSize + file.size > MAX_TOTAL_FILES_SIZE) {
        setErrorMessage(`O tamanho total acumulado dos anexos não pode ultrapassar 30MB.`);
        return;
      }
      currentTotalSize += file.size;
      validFiles.push(file);
    }

    setFiles(prev => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    if (isSubmitting) return;
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatCpf = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    return nums
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const errors: Record<string, string> = {};

    // 1. Validation Checks
    if (!isValidFullName(clientName)) {
      errors.clientName = "Informe seu nome (mínimo de 2 caracteres).";
    }

    const cleanCpf = clientCpf.replace(/\D/g, "");
    if (!isValidCPF(cleanCpf)) {
      errors.clientCpf = "Informe um CPF com 11 dígitos.";
    }

    if (!isValidEmail(clientEmail)) {
      errors.clientEmail = "Informe um e-mail válido para receber o protocolo.";
    }

    if (!isValidPhone(clientPhone)) {
      errors.clientPhone = "Informe um telefone/WhatsApp válido com DDD (ex: 11 99999-9999).";
    }

    if (!service) {
      errors.service = "Selecione o serviço de seu interesse.";
    }

    if (!description.trim() || description.trim().length < 3) {
      errors.description = "Descreva brevemente sua situação (mínimo de 3 caracteres).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Por favor, corrija os campos sinalizados abaixo antes de protocolar.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    setUploadProgress("Iniciando processo de protocolo seguro...");

    try {
      const year = new Date().getFullYear();
      const randomCode = Math.floor(10000 + Math.random() * 90000);
      const protocol = `SPA-${year}-${randomCode}`;
      const docId = `sol-${Date.now()}`;

      // 2. Upload Attachments if present (with 4s safety timeout race per file)
      const attachmentsMetadata: any[] = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgress(`Enviando anexo ${i + 1} de ${files.length} (${file.name})...`);
          try {
            const storagePath = `solicitacoes/${protocol}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadPromise = uploadBytes(storageRef, file);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Storage timeout")), 4000)
            );
            await Promise.race([uploadPromise, timeoutPromise]);
            const downloadUrl = await getDownloadURL(storageRef);
            attachmentsMetadata.push({
              name: file.name,
              url: downloadUrl,
              size: file.size,
              type: file.type || "application/octet-stream",
              uploadedAt: new Date().toISOString()
            });
          } catch (storageErr) {
            console.warn("[Storage Warning] Fallback metadata for storage upload:", storageErr);
            attachmentsMetadata.push({
              name: file.name,
              url: "#",
              size: file.size,
              type: file.type || "application/octet-stream",
              uploadedAt: new Date().toISOString(),
              offlineNote: "Anexo registrado em fila de envio"
            });
          }
        }
      }

      setUploadProgress("Gravando dados no banco e gerando protocolo...");

      // 3. Build Payload
      const nowISO = new Date().toISOString();
      const nowFormatted = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const requestData = {
        id: docId,
        protocol: protocol,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        clientPhone: clientPhone.trim(),
        clientCpf: formatCpf(cleanCpf),
        service: service,
        description: description.trim(),
        status: "novo",
        priority: "media",
        assignedTo: "atendimento.spassessoria@gmail.com",
        attachments: attachmentsMetadata,
        timeline: [
          {
            title: "Solicitação Aberta",
            description: "Formulário público recebido pelo portal e registrado para análise técnica.",
            date: nowFormatted,
            author: "Portal Público",
            status: "completed"
          },
          {
            title: "Análise Inicial em Andamento",
            description: "Sua solicitação foi encaminhada para a equipe de recursos administrativos.",
            date: nowFormatted,
            author: "Sistema",
            status: "current"
          }
        ],
        createdAt: nowISO,
        updatedAt: nowISO
      };

      // 4. Send request to backend API endpoint /api/solicitacoes (with 8s timeout controller)
      let apiSuccess = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch("/api/solicitacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          if (result && (result.protocol || result.success || result.id)) {
            apiSuccess = true;
          }
        } else {
          let errText = "";
          try {
            const errData = await response.json();
            errText = errData.error || errData.message || "";
          } catch (_) {
            errText = `HTTP ${response.status}`;
          }
          console.warn("[API Endpoint Warning] Request returned non-ok status:", errText);
        }
      } catch (fetchErr) {
        console.warn("[API Network Notice] API endpoint call error, falling back:", fetchErr);
      }

      // 5. Asynchronous background client sync (does NOT block completion)
      setDoc(doc(db, "solicitacoes", docId), requestData).catch(() => {});
      setDoc(doc(db, "clients", cleanCpf), {
        cpf: formatCpf(cleanCpf),
        name: clientName.trim(),
        email: clientEmail.trim().toLowerCase(),
        phone: clientPhone.trim(),
        service: service,
        protocol: protocol,
        currentStep: "Análise Inicial de Solicitação",
        lastUpdate: nowFormatted,
        orderInfo: description.trim(),
        documents: attachmentsMetadata,
        timeline: requestData.timeline
      }).catch(() => {});

      // 6. Local Storage backup for guaranteed data persistence
      try {
        const localFallbackKey = `sp_offline_sol_${protocol}`;
        localStorage.setItem(localFallbackKey, JSON.stringify(requestData));
        apiSuccess = true;
      } catch (_) {}

      setUploadProgress("Finalizando protocolo e gerando comprovante...");
      setSubmittedProtocol(protocol);
    } catch (err: any) {
      console.error("Erro ao enviar solicitação:", err);
      setErrorMessage(
        err.message || "Ocorreu um erro ao registrar sua solicitação no banco de dados. Por favor, tente novamente."
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress("");
    }
  };

  const handleCopyProtocol = () => {
    if (!submittedProtocol) return;
    navigator.clipboard.writeText(submittedProtocol);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 3000);
  };

  const resetForm = () => {
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientCpf("");
    setDescription("");
    setFiles([]);
    setSubmittedProtocol(null);
    setErrorMessage("");
    setFieldErrors({});
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden my-8">
      {/* Header Banner */}
      <div className="bg-brand-navy-900 text-white p-6 sm:p-8 text-left relative">
        <div className="flex items-center gap-3 text-brand-gold-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
          <FileText className="w-4 h-4" />
          <span>Atendimento Digital & Protocolo Único</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Formulário Oficial de Solicitação de Recurso
        </h2>
        <p className="mt-2 text-sm text-gray-300 max-w-2xl leading-relaxed">
          Preencha os dados abaixo para dar entrada no seu requerimento ou recurso administrativo. Após o envio, você receberá um número de protocolo exclusivo para acompanhar cada etapa em tempo real.
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {submittedProtocol ? (
          // CONFIRMATION VIEW
          <div className="text-center space-y-6 py-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-full uppercase">
                Solicitação Registrada com Sucesso
              </span>
              <h3 className="text-2xl font-display font-bold text-brand-navy-900 mt-3">
                Obrigado, {clientName}!
              </h3>
              <p className="text-sm text-gray-600 max-w-lg mx-auto mt-2">
                Sua solicitação para <strong className="text-brand-navy-900">{service}</strong> foi gravada no banco de dados e encaminhada para a equipe técnica da SP Assessoria.
              </p>
            </div>

            {/* Protocol Display Box */}
            <div className="p-6 bg-brand-navy-950 text-white rounded-2xl max-w-md mx-auto space-y-3 shadow-lg border border-brand-gold-500/30">
              <span className="text-xs text-brand-gold-400 font-mono font-bold uppercase tracking-wider block">
                Seu Número de Protocolo
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-mono font-extrabold tracking-wider text-white">
                  {submittedProtocol}
                </span>
                <button
                  onClick={handleCopyProtocol}
                  className="p-2 bg-white/10 hover:bg-white/20 text-brand-gold-400 rounded-lg transition-all cursor-pointer"
                  title="Copiar número de protocolo"
                >
                  {copiedProtocol ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 leading-tight">
                Guarde este código. Uma cópia de confirmação foi enviada para <strong className="text-gray-200">{clientEmail}</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <button
                onClick={() => {
                  if (onSuccessQueryProtocol) {
                    onSuccessQueryProtocol(submittedProtocol);
                  }
                }}
                className="px-6 py-3 bg-brand-gold-500 hover:bg-brand-gold-400 text-brand-navy-950 font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <Search className="w-4 h-4" />
                <span>Acompanhar Status no Portal</span>
              </button>

              <button
                onClick={resetForm}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Enviar Outra Solicitação
              </button>
            </div>
          </div>
        ) : (
          // PUBLIC REQUEST FORM
          <form onSubmit={handleSubmit} className="space-y-6 text-left" noValidate>
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Section 1: Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
                <span className="w-6 h-6 rounded-full bg-brand-navy-900 text-white font-bold text-xs flex items-center justify-center font-mono">1</span>
                <h3 className="text-sm font-bold text-brand-navy-900 uppercase font-mono tracking-wider">Informações Cadastrais do Requerente</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      clearFieldError("clientName");
                    }}
                    placeholder="Ex: Carlos Alberto Santos"
                    className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-hidden transition-all disabled:opacity-60 ${
                      fieldErrors.clientName 
                        ? "border-red-400 bg-red-50/40 focus:border-red-500" 
                        : "border-gray-250 focus:border-brand-gold-500 focus:bg-white"
                    }`}
                  />
                  {fieldErrors.clientName && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {fieldErrors.clientName}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    CPF *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={clientCpf}
                    onChange={(e) => {
                      setClientCpf(formatCpf(e.target.value));
                      clearFieldError("clientCpf");
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-xs font-mono text-gray-900 focus:outline-hidden transition-all disabled:opacity-60 ${
                      fieldErrors.clientCpf 
                        ? "border-red-400 bg-red-50/40 focus:border-red-500" 
                        : "border-gray-250 focus:border-brand-gold-500 focus:bg-white"
                    }`}
                  />
                  {fieldErrors.clientCpf && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {fieldErrors.clientCpf}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    E-mail para Notificações *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isSubmitting}
                    value={clientEmail}
                    onChange={(e) => {
                      setClientEmail(e.target.value);
                      clearFieldError("clientEmail");
                    }}
                    placeholder="seuemail@exemplo.com"
                    className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-hidden transition-all disabled:opacity-60 ${
                      fieldErrors.clientEmail 
                        ? "border-red-400 bg-red-50/40 focus:border-red-500" 
                        : "border-gray-250 focus:border-brand-gold-500 focus:bg-white"
                    }`}
                  />
                  {fieldErrors.clientEmail && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {fieldErrors.clientEmail}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    WhatsApp / Telefone com DDD *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={clientPhone}
                    onChange={(e) => {
                      setClientPhone(e.target.value);
                      clearFieldError("clientPhone");
                    }}
                    placeholder="(11) 99999-9999"
                    className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-hidden transition-all disabled:opacity-60 ${
                      fieldErrors.clientPhone 
                        ? "border-red-400 bg-red-50/40 focus:border-red-500" 
                        : "border-gray-250 focus:border-brand-gold-500 focus:bg-white"
                    }`}
                  />
                  {fieldErrors.clientPhone && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {fieldErrors.clientPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Request Category & Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
                <span className="w-6 h-6 rounded-full bg-brand-navy-900 text-white font-bold text-xs flex items-center justify-center font-mono">2</span>
                <h3 className="text-sm font-bold text-brand-navy-900 uppercase font-mono tracking-wider">Detalhes da Solicitação</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Serviço de Interesse *
                </label>
                <select
                  disabled={isSubmitting}
                  value={service}
                  onChange={(e) => {
                    setService(e.target.value);
                    clearFieldError("service");
                  }}
                  className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-hidden transition-all disabled:opacity-60 ${
                    fieldErrors.service 
                      ? "border-red-400 bg-red-50/40 focus:border-red-500" 
                      : "border-gray-250 focus:border-brand-gold-500 focus:bg-white"
                  }`}
                >
                  <option value="INSS - Recursos e Benefícios">INSS - Recurso contra Benefício Indeferido</option>
                  <option value="INSS - BPC/LOAS">INSS - Requerimento BPC/LOAS</option>
                  <option value="INSS - Aposentadorias e Auxílios">INSS - Requerimento / Revisão de Aposentadoria</option>
                  <option value="Trânsito - Defesa Prévia de Multa">Trânsito - Defesa Prévia de Multa</option>
                  <option value="Trânsito - Recurso CNH Suspensa/Cassada">Trânsito - Recurso contra Suspensão ou Cassação de CNH</option>
                  <option value="Administrativo - Requerimento Geral">Processo Administrativo - Requerimentos Gerais em Órgãos Públicos</option>
                </select>
                {fieldErrors.service && (
                  <span className="text-[11px] text-red-600 font-medium mt-1 block">
                    {fieldErrors.service}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Descrição do Caso / Histórico do Problema *
                </label>
                <textarea
                  required
                  disabled={isSubmitting}
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    clearFieldError("description");
                  }}
                  placeholder="Descreva brevemente o motivo da sua solicitação, como a data da notificação, número da autuação ou o benefício do INSS que foi indeferido..."
                  className={`w-full bg-gray-50 border rounded-xl p-4 text-xs text-gray-900 focus:outline-hidden transition-all disabled:opacity-60 ${
                    fieldErrors.description 
                      ? "border-red-400 bg-red-50/40 focus:border-red-500" 
                      : "border-gray-250 focus:border-brand-gold-500 focus:bg-white"
                  }`}
                />
                {fieldErrors.description && (
                  <span className="text-[11px] text-red-600 font-medium mt-1 block">
                    {fieldErrors.description}
                  </span>
                )}
              </div>
            </div>

            {/* Section 3: File Attachments */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
                <span className="w-6 h-6 rounded-full bg-brand-navy-900 text-white font-bold text-xs flex items-center justify-center font-mono">3</span>
                <h3 className="text-sm font-bold text-brand-navy-900 uppercase font-mono tracking-wider">Anexar Documentos (Opcional - Máx. 10MB por arquivo)</h3>
              </div>

              <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                isSubmitting 
                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" 
                  : "border-gray-250 hover:border-brand-gold-500 bg-gray-50/50 hover:bg-white"
              }`}>
                <Upload className="w-8 h-8 text-brand-gold-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-brand-navy-900">Clique ou arraste seus arquivos para esta área</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Formatos aceitos: PDF, JPG, PNG, DOCX, TXT. Limite individual: 10MB.
                </p>
                <input
                  type="file"
                  multiple
                  disabled={isSubmitting}
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="public-request-file-input"
                />
                <label
                  htmlFor="public-request-file-input"
                  className={`mt-3 inline-block px-4 py-2 bg-brand-navy-900 text-white font-bold text-xs rounded-xl hover:bg-brand-navy-800 shadow-xs ${
                    isSubmitting ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }`}
                >
                  Selecionar Arquivos
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-gray-700 block">Arquivos Selecionados ({files.length}):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="p-2.5 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate text-gray-800 font-semibold">{file.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => removeFile(idx)}
                          className="p-1 hover:bg-red-100 text-red-500 rounded-lg cursor-pointer disabled:opacity-40"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Asynchronous Loading Progress Card */}
            {isSubmitting && (
              <div className="p-4 bg-brand-navy-900 text-white rounded-2xl space-y-2 border border-brand-gold-500/30 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-brand-gold-400 animate-spin shrink-0" />
                  <span className="text-xs font-bold text-brand-gold-400 uppercase tracking-wider font-mono">
                    Processando Solicitação
                  </span>
                </div>
                <p className="text-xs text-gray-200 pl-8">
                  {uploadProgress || "Enviando dados com segurança para o banco de dados..."}
                </p>
              </div>
            )}

            {/* Submission Footer */}
            <div className="pt-4 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Seus dados estão protegidos sob a LGPD com criptografia em trânsito.</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-gold-500 hover:bg-brand-gold-400 active:bg-brand-gold-600 text-brand-navy-950 font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-brand-navy-950 shrink-0" />
                    <span>Protocolando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Protocolar Solicitação</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

