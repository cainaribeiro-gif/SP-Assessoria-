import React, { useState, useEffect } from "react";
import { 
  Lock, 
  User, 
  X, 
  Settings, 
  FileText, 
  HelpCircle, 
  Users, 
  Check, 
  Trash2, 
  Edit, 
  Plus, 
  Save, 
  LogOut, 
  Briefcase, 
  Award, 
  Phone, 
  Shield, 
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Mail,
  MapPin,
  Calendar
} from "lucide-react";

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  siteData: any;
  onDataUpdate: (newData: any) => void;
}

export function AdminDashboard({ isOpen, onClose, siteData, onDataUpdate }: AdminDashboardProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<"leads" | "blog" | "services" | "faqs" | "config">("leads");

  // Local editable copies of data
  const [localLeads, setLocalLeads] = useState<any[]>([]);
  const [localBlog, setLocalBlog] = useState<any[]>([]);
  const [localFaqs, setLocalFaqs] = useState<any[]>([]);
  const [localServices, setLocalServices] = useState<any>({});
  const [localConfig, setLocalConfig] = useState<any>({});
  
  // Edit forms states
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editingFaq, setEditingFaq] = useState<any | null>(null);
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [showNewFaqForm, setShowNewFaqForm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Populate local states when siteData loads
  useEffect(() => {
    if (siteData) {
      setLocalLeads(siteData.leads || []);
      setLocalBlog(siteData.blogPosts || []);
      setLocalFaqs(siteData.faqs || []);
      setLocalServices(siteData.services || {});
      setLocalConfig(siteData.siteConfig || {});
    }
  }, [siteData]);

  // Check login session
  useEffect(() => {
    const token = localStorage.getItem("sp_admin_token");
    if (token === "sp_admin_token_2026_secured") {
      setIsLoggedIn(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem("sp_admin_token", data.token);
        setIsLoggedIn(true);
        setUsername("");
        setPassword("");
      } else {
        setLoginError(data.error || "Credenciais inválidas");
      }
    } catch (err) {
      setLoginError("Erro de conexão com o servidor.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sp_admin_token");
    setIsLoggedIn(false);
  };

  const persistDataOnServer = async (updatedData: any) => {
    try {
      setSaveError("");
      const response = await fetch("/api/site-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      });
      if (response.ok) {
        onDataUpdate(updatedData);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError("Erro ao salvar alterações no servidor.");
      }
    } catch (err) {
      setSaveError("Erro de comunicação com o servidor.");
    }
  };

  // LEAD ACTIONS
  const handleUpdateLeadStatus = (leadId: string, newStatus: string) => {
    const updatedLeads = localLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l);
    setLocalLeads(updatedLeads);
    const updatedData = { ...siteData, leads: updatedLeads };
    persistDataOnServer(updatedData);
  };

  const handleDeleteLead = (leadId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este lead permanentemente?")) return;
    const updatedLeads = localLeads.filter(l => l.id !== leadId);
    setLocalLeads(updatedLeads);
    const updatedData = { ...siteData, leads: updatedLeads };
    persistDataOnServer(updatedData);
  };

  // BLOG ACTIONS
  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost.title || !editingPost.content) return;

    let updatedBlog;
    if (showNewPostForm) {
      const newPost = {
        ...editingPost,
        id: `post-${Date.now()}`,
        date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
        readTime: editingPost.readTime || "5 min de leitura"
      };
      updatedBlog = [newPost, ...localBlog];
    } else {
      updatedBlog = localBlog.map(p => p.id === editingPost.id ? editingPost : p);
    }

    setLocalBlog(updatedBlog);
    setEditingPost(null);
    setShowNewPostForm(false);
    const updatedData = { ...siteData, blogPosts: updatedBlog };
    persistDataOnServer(updatedData);
  };

  const handleDeletePost = (postId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este artigo permanentemente?")) return;
    const updatedBlog = localBlog.filter(p => p.id !== postId);
    setLocalBlog(updatedBlog);
    const updatedData = { ...siteData, blogPosts: updatedBlog };
    persistDataOnServer(updatedData);
  };

  // FAQ ACTIONS
  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq.question || !editingFaq.answer) return;

    let updatedFaqs;
    if (showNewFaqForm) {
      const newFaq = {
        ...editingFaq,
        id: `faq-${Date.now()}`
      };
      updatedFaqs = [...localFaqs, newFaq];
    } else {
      updatedFaqs = localFaqs.map(f => f.id === editingFaq.id ? editingFaq : f);
    }

    setLocalFaqs(updatedFaqs);
    setEditingFaq(null);
    setShowNewFaqForm(false);
    const updatedData = { ...siteData, faqs: updatedFaqs };
    persistDataOnServer(updatedData);
  };

  const handleDeleteFaq = (faqId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta dúvida permanentemente?")) return;
    const updatedFaqs = localFaqs.filter(f => f.id !== faqId);
    setLocalFaqs(updatedFaqs);
    const updatedData = { ...siteData, faqs: updatedFaqs };
    persistDataOnServer(updatedData);
  };

  // CONFIG ACTIONS
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData = { ...siteData, siteConfig: localConfig };
    persistDataOnServer(updatedData);
  };

  // SERVICES ACTIONS
  const handleServiceChange = (key: string, field: string, value: any) => {
    const updatedServices = {
      ...localServices,
      [key]: {
        ...localServices[key],
        [field]: value
      }
    };
    setLocalServices(updatedServices);
  };

  const handleServiceItemChange = (key: string, itemIdx: number, val: string) => {
    const items = [...localServices[key].items];
    items[itemIdx] = val;
    handleServiceChange(key, "items", items);
  };

  const handleAddServiceItem = (key: string) => {
    const items = [...(localServices[key].items || []), "Novo serviço..."];
    handleServiceChange(key, "items", items);
  };

  const handleRemoveServiceItem = (key: string, itemIdx: number) => {
    const items = localServices[key].items.filter((_: any, idx: number) => idx !== itemIdx);
    handleServiceChange(key, "items", items);
  };

  const handleSaveServices = () => {
    const updatedData = { ...siteData, services: localServices };
    persistDataOnServer(updatedData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div 
        id="admin-dashboard-container"
        className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] border border-gray-150"
      >
        
        {/* TOP BAR / HEADER */}
        <div className="bg-brand-navy-900 px-6 py-4 flex items-center justify-between text-white border-b border-brand-navy-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gold-500/10 border border-brand-gold-500/30 flex items-center justify-center text-brand-gold-500">
              <Settings className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="block text-xs uppercase tracking-widest text-brand-gold-500 font-mono font-bold">SP ASSESSORIA</span>
              <span className="text-sm sm:text-base font-bold font-display">Painel Administrativo Restrito</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-brand-navy-800 hover:bg-brand-navy-750 text-xs text-brand-gold-500 hover:text-brand-gold-400 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair do Painel</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-brand-navy-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* NOT LOGGED IN - SHOW FORM */}
        {!isLoggedIn ? (
          <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8 sm:p-16 min-h-[450px]">
            <div className="w-full max-w-md bg-white border border-gray-150 rounded-2xl p-8 shadow-lg text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600">
                <Lock className="w-8 h-8" />
              </div>
              
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy-900">Acesso Restrito ao Gestor</h3>
                <p className="text-xs text-gray-500 mt-1">Insira suas credenciais administrativas para gerenciar o site.</p>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-red-600 text-xs text-left">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider text-left mb-1">E-mail de Acesso</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-450" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: atendimento@sprecursosadm.com.br"
                      className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider text-left mb-1">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-450" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  Entrar no Sistema
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* LOGGED IN - ADMIN LAYOUT */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* SIDEBAR TABS */}
            <div className="w-full md:w-60 bg-[#fafafb] border-r border-gray-200 flex flex-col md:justify-between py-4">
              <div className="space-y-1 px-2">
                <button
                  onClick={() => { setActiveTab("leads"); setEditingPost(null); setEditingFaq(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "leads" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Leads & Consultas</span>
                  {localLeads.filter(l => l.status === "Novo").length > 0 && (
                    <span className="ml-auto bg-red-500 text-white rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-bold">
                      {localLeads.filter(l => l.status === "Novo").length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab("blog"); setEditingPost(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "blog" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Gerenciar Blog</span>
                </button>

                <button
                  onClick={() => { setActiveTab("services"); setEditingPost(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "services" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Configurar Serviços</span>
                </button>

                <button
                  onClick={() => { setActiveTab("faqs"); setEditingFaq(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "faqs" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Gerenciar FAQs</span>
                </button>

                <button
                  onClick={() => { setActiveTab("config"); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "config" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Configurações do Site</span>
                </button>
              </div>

              {/* STATS STRIP ON SIDEBAR */}
              <div className="hidden md:block p-4 mx-3 bg-[#e4e7eb]/40 border border-gray-200/50 rounded-xl space-y-2">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-gray-400">Status do Banco</span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Leads Ativos</span>
                  <strong className="text-brand-navy-900">{localLeads.length}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Artigos Blog</span>
                  <strong className="text-brand-navy-900">{localBlog.length}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">FAQs Cadastradas</span>
                  <strong className="text-brand-navy-900">{localFaqs.length}</strong>
                </div>
              </div>
            </div>

            {/* MAIN DASHBOARD CONTENT AREA */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50 flex flex-col justify-between">
              
              {/* SAVE MESSAGES */}
              {saveSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Alterações salvas com sucesso e publicadas em tempo real!</span>
                </div>
              )}
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-150 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                  <X className="w-4 h-4 text-red-600" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* TAB 1: LEADS & CONSULTAS */}
              {activeTab === "leads" && (
                <div className="space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Leads & Consultas Coletadas</h2>
                      <p className="text-xs text-gray-500">Acompanhe as pessoas que preencheram o simulador ou formulário de contato do site.</p>
                    </div>
                  </div>

                  {localLeads.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-150 rounded-xl text-gray-400 space-y-2 text-xs">
                      <Users className="w-10 h-10 text-gray-300 mx-auto" />
                      <p>Nenhum lead ou solicitação registrada até o momento.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {localLeads.map((lead) => (
                        <div 
                          key={lead.id}
                          className={`p-5 bg-white border rounded-xl shadow-xs relative flex flex-col sm:flex-row justify-between gap-4 transition-all hover:shadow-sm ${
                            lead.status === "Novo" ? "border-l-4 border-l-brand-gold-500 border-gray-150" : "border-gray-150"
                          }`}
                        >
                          {/* Left contents */}
                          <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono tracking-wide ${
                                lead.type === "Orçamento" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                              }`}>
                                {lead.type || "Contato"}
                              </span>
                              <span className="text-gray-400 font-mono text-[10px]">
                                {lead.date}
                              </span>
                              <span className={`ml-auto sm:ml-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono tracking-wide ${
                                lead.status === "Novo" 
                                  ? "bg-brand-gold-100 text-brand-gold-800 border border-brand-gold-200" 
                                  : lead.status === "Em Atendimento"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                {lead.status}
                              </span>
                            </div>

                            <div className="text-xs">
                              <h4 className="text-sm font-bold text-brand-navy-900">{lead.name}</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1 text-gray-600 font-medium">
                                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> WhatsApp: <strong>{lead.phone}</strong></span>
                                {lead.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> E-mail: <strong>{lead.email}</strong></span>}
                              </div>
                              <div className="mt-1">
                                <span className="text-gray-400">Interesse:</span> <strong className="text-brand-navy-850">{lead.service}</strong>
                              </div>
                            </div>

                            {lead.message && (
                              <p className="text-xs p-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-600 italic whitespace-pre-line leading-relaxed">
                                "{lead.message}"
                              </p>
                            )}
                          </div>

                          {/* Right actions */}
                          <div className="flex sm:flex-col items-end sm:justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              {lead.status !== "Em Atendimento" && lead.status !== "Concluído" && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, "Em Atendimento")}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-200 cursor-pointer"
                                >
                                  Marcar Atendimento
                                </button>
                              )}
                              {lead.status !== "Concluído" && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, "Concluído")}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 cursor-pointer"
                                >
                                  Concluir Lead
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteLead(lead.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg border border-red-100 cursor-pointer ml-auto sm:ml-0"
                                title="Excluir Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* WhatsApp Direct */}
                            <a
                              href={`https://api.whatsapp.com/send?phone=${lead.phone.replace(/\D/g, "")}&text=${encodeURIComponent(`Olá ${lead.name}, aqui é o gestor da SP Assessoria. Recebemos sua solicitação de assessoria sobre ${lead.service}. Como podemos ajudar?`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shadow-xs"
                            >
                              <Phone className="w-3 h-3 fill-white" />
                              Chamar no WhatsApp
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: GERENCIAR BLOG */}
              {activeTab === "blog" && (
                <div className="space-y-6 text-left">
                  
                  {!editingPost && !showNewPostForm ? (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Artigos do Blog</h2>
                          <p className="text-xs text-gray-500">Adicione, edite ou exclua posts informativos do site.</p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingPost({ title: "", category: "INSS", summary: "", content: "", imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80", readTime: "5 min de leitura" });
                            setShowNewPostForm(true);
                          }}
                          className="px-3.5 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Novo Artigo</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localBlog.map((post) => (
                          <div 
                            key={post.id} 
                            className="bg-white border border-gray-150 rounded-xl overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-sm"
                          >
                            <div className="flex gap-4 p-4">
                              <img 
                                src={post.imageUrl} 
                                alt={post.title} 
                                className="w-20 h-20 object-cover rounded-lg shrink-0 border border-gray-100"
                              />
                              <div className="space-y-1">
                                <span className="bg-brand-gold-100 text-brand-gold-800 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                  {post.category}
                                </span>
                                <h4 className="font-bold text-brand-navy-900 text-sm line-clamp-1">{post.title}</h4>
                                <p className="text-xs text-gray-500 line-clamp-2">{post.summary}</p>
                              </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center text-xs">
                              <span className="text-gray-400 font-mono text-[10px]">{post.date}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingPost(post);
                                    setShowNewPostForm(false);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg bg-white cursor-pointer"
                                  title="Editar Artigo"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 border border-red-100 rounded-lg bg-white cursor-pointer"
                                  title="Excluir Artigo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* EDIT / NEW POST FORM */
                    <form onSubmit={handleSavePost} className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="text-base font-display font-bold text-brand-navy-900">
                          {showNewPostForm ? "Criar Novo Artigo de Blog" : `Editar Artigo: ${editingPost.title}`}
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setEditingPost(null); setShowNewPostForm(false); }}
                          className="text-xs text-gray-400 hover:text-gray-600 font-bold"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        <div className="sm:col-span-8">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título do Artigo</label>
                          <input
                            type="text"
                            required
                            value={editingPost.title}
                            onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Categoria</label>
                          <select
                            value={editingPost.category}
                            onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          >
                            <option value="INSS">INSS</option>
                            <option value="Trânsito">Trânsito</option>
                            <option value="Administrativo">Administrativo</option>
                            <option value="Direitos">Direitos</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        <div className="sm:col-span-8">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">URL da Imagem Unsplash</label>
                          <input
                            type="text"
                            required
                            value={editingPost.imageUrl}
                            onChange={(e) => setEditingPost({ ...editingPost, imageUrl: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tempo de Leitura</label>
                          <input
                            type="text"
                            required
                            value={editingPost.readTime}
                            onChange={(e) => setEditingPost({ ...editingPost, readTime: e.target.value })}
                            placeholder="Ex: 5 min de leitura"
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resumo Curto (Listagem)</label>
                        <input
                          type="text"
                          required
                          value={editingPost.summary}
                          onChange={(e) => setEditingPost({ ...editingPost, summary: e.target.value })}
                          placeholder="Aparece no card do blog"
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Conteúdo Completo do Artigo (Markdown ou Texto)</label>
                        <textarea
                          required
                          value={editingPost.content}
                          onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                          rows={8}
                          placeholder="Texto completo do informativo..."
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white resize-y font-sans"
                        />
                      </div>

                      <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => { setEditingPost(null); setShowNewPostForm(false); }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>Salvar Artigo</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              )}

              {/* TAB 3: CONFIGURAR SERVIÇOS */}
              {activeTab === "services" && localServices.inss && (
                <div className="space-y-6 text-left">
                  <div>
                    <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Configurar Serviços & Atuação</h2>
                    <p className="text-xs text-gray-500">Edite as descrições e itens que aparecem nas abas de atuação da página.</p>
                  </div>

                  <div className="space-y-6">
                    {Object.keys(localServices).map((key) => {
                      const service = localServices[key];
                      return (
                        <div key={key} className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm sm:text-base font-bold text-brand-navy-900 border-b border-gray-100 pb-2 flex items-center gap-2 uppercase font-mono">
                            <Briefcase className="w-4 h-4 text-brand-gold-600" />
                            <span>Serviço: {service.title}</span>
                          </h3>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título de Exibição</label>
                              <input
                                type="text"
                                value={service.title}
                                onChange={(e) => handleServiceChange(key, "title", e.target.value)}
                                className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição Comercial</label>
                              <textarea
                                value={service.description}
                                onChange={(e) => handleServiceChange(key, "description", e.target.value)}
                                rows={2}
                                className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden resize-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Itens Abrangidos (Balões)</label>
                              <div className="space-y-2 mt-1">
                                {service.items.map((item: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item}
                                      onChange={(e) => handleServiceItemChange(key, idx, e.target.value)}
                                      className="flex-1 bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveServiceItem(key, idx)}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 cursor-pointer bg-white"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleAddServiceItem(key)}
                                  className="px-3 py-1.5 text-[10px] font-bold bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Adicionar Item</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="bg-white border border-gray-150 rounded-xl p-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveServices}
                        className="px-5 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Publicar Todos os Serviços</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FAQ MANAGEMENT */}
              {activeTab === "faqs" && (
                <div className="space-y-6 text-left">
                  
                  {!editingFaq && !showNewFaqForm ? (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Perguntas Frequentes (FAQs)</h2>
                          <p className="text-xs text-gray-500">Gerencie as perguntas e respostas mais comuns que aparecem na home do site.</p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingFaq({ question: "", answer: "" });
                            setShowNewFaqForm(true);
                          }}
                          className="px-3.5 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Nova Pergunta</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {localFaqs.map((faq) => (
                          <div 
                            key={faq.id} 
                            className="bg-white border border-gray-150 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-xs"
                          >
                            <div className="space-y-1 text-left flex-1">
                              <h4 className="font-bold text-brand-navy-900 text-sm">{faq.question}</h4>
                              <p className="text-xs text-gray-500 line-clamp-1">{faq.answer}</p>
                            </div>
                            <div className="flex gap-2 justify-end sm:justify-start shrink-0">
                              <button
                                onClick={() => {
                                  setEditingFaq(faq);
                                  setShowNewFaqForm(false);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg bg-white cursor-pointer"
                                title="Editar Pergunta"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFaq(faq.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 border border-red-100 rounded-lg bg-white cursor-pointer"
                                title="Excluir Pergunta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* FAQ FORM */
                    <form onSubmit={handleSaveFaq} className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="text-base font-display font-bold text-brand-navy-900">
                          {showNewFaqForm ? "Criar Nova Dúvida Frequente" : "Editar Dúvida"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setEditingFaq(null); setShowNewFaqForm(false); }}
                          className="text-xs text-gray-400 hover:text-gray-600 font-bold"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pergunta do Cidadão</label>
                        <input
                          type="text"
                          required
                          value={editingFaq.question}
                          onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resposta Explicativa</label>
                        <textarea
                          required
                          value={editingFaq.answer}
                          onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                          rows={4}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white resize-y font-sans"
                        />
                      </div>

                      <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => { setEditingFaq(null); setShowNewFaqForm(false); }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>Salvar Dúvida</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              )}

              {/* TAB 5: GENERAL CONFIGURATION */}
              {activeTab === "config" && (
                <div className="space-y-6 text-left">
                  <div>
                    <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Configurações Globais do Site</h2>
                    <p className="text-xs text-gray-500">Edite os telefones de contato, dados da empresa, redes sociais e textos da hero principal.</p>
                  </div>

                  <form onSubmit={handleSaveConfig} className="space-y-6">
                    {/* Contact details */}
                    <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-brand-navy-900 border-b border-gray-100 pb-2">Canais de Contato & Institucional</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp Principal (Somente números, ex: 5511987049051)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.phone}
                            onChange={(e) => setLocalConfig({ ...localConfig, phone: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp Auxiliar (Somente números, ex: 5511993344293)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.phoneAux}
                            onChange={(e) => setLocalConfig({ ...localConfig, phoneAux: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">E-mail Corporativo</label>
                          <input
                            type="email"
                            required
                            value={localConfig.email}
                            onChange={(e) => setLocalConfig({ ...localConfig, email: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">CNPJ Ativo</label>
                          <input
                            type="text"
                            required
                            value={localConfig.cnpj}
                            onChange={(e) => setLocalConfig({ ...localConfig, cnpj: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Instagram (@spra.assessoria)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.instagram}
                            onChange={(e) => setLocalConfig({ ...localConfig, instagram: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Slogans and banner */}
                    <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-brand-navy-900 border-b border-gray-100 pb-2">Hero Banner Principal</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título da Hero (Linha 1)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.heroTitle}
                            onChange={(e) => setLocalConfig({ ...localConfig, heroTitle: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título Destacado (Dourado)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.heroTitleAccent}
                            onChange={(e) => setLocalConfig({ ...localConfig, heroTitleAccent: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Slogan Principal (Aspas)</label>
                        <input
                          type="text"
                          required
                          value={localConfig.heroSubtitle}
                          onChange={(e) => setLocalConfig({ ...localConfig, heroSubtitle: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Parágrafo Descritivo Secundário</label>
                        <textarea
                          required
                          value={localConfig.heroDescription}
                          onChange={(e) => setLocalConfig({ ...localConfig, heroDescription: e.target.value })}
                          rows={3}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-gray-150 rounded-xl p-4 flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Salvar Configurações Gerais</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* BOTTOM STATS/FOOTER */}
              <div className="mt-8 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
                <span>© 2026 SP Assessoria de Recursos Administrativos • Ambiente Restrito</span>
                <span>Última Sincronização do Servidor: {new Date().toLocaleTimeString("pt-BR")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
