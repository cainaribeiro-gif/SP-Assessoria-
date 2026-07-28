import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Scale, 
  Car, 
  CheckCircle2, 
  MessageSquare, 
  Phone, 
  Shield, 
  Search, 
  Award, 
  Clock, 
  UserCheck, 
  Users, 
  Menu, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Star, 
  Send, 
  Calendar, 
  ArrowRight, 
  HelpCircle,
  BookOpen,
  MapPin,
  Mail,
  Info,
  Sliders,
  Check,
  Briefcase,
  AlertTriangle,
  Lock,
  ExternalLink
} from "lucide-react";
import { BudgetModal } from "./components/BudgetModal";
import { LegalModal } from "./components/LegalModals";
import { WhatsAppButton } from "./components/WhatsAppButton";
import { WhatsAppLeadModal } from "./components/WhatsAppLeadModal";
import { AdminDashboard } from "./components/AdminDashboard";
import { PublicRequestForm } from "./components/PublicRequestForm";
import { Logo } from "./components/Logo";
import defaultSiteData from "./site-data.json";
import { ServiceItem, BlogPost, FAQItem, Review, ProcessStatus, TimelineStep } from "./types";
import { auth } from "./firebase";

// Static content for the landing page
const SERVICES: Record<"inss" | "transito" | "administrativo", ServiceItem> = {
  inss: {
    title: "INSS & Previdenciário",
    description: "Análise estratégica e recursos contra indeferimentos de benefícios no INSS. Atuamos com foco estritamente administrativo para agilizar sua concessão.",
    items: [
      "Recursos Administrativos contra indeferimentos",
      "Defesa e justificativa em benefícios negados",
      "Revisões de benefícios na esfera administrativa",
      "Cumprimento de exigências com agilidade",
      "Acompanhamento diário e monitoramento de processos",
      "BPC/LOAS (fase administrativa completa)",
      "Protocolos diversos e requerimentos de aposentadoria"
    ]
  },
  transito: {
    title: "Trânsito & CNH",
    description: "Defesa técnica de condutores perante órgãos de trânsito (DETRAN, JARI, CETRAN). Proteja seu direito de dirigir sem burocracia.",
    items: [
      "Defesa Prévia técnica fundamentada",
      "Recurso de Multas graves, gravíssimas e suspensivas",
      "Recurso contra Processo de Suspensão da CNH",
      "Recurso contra Cassação do Direito de Dirigir",
      "Defesa em Processo Administrativo de Trânsito geral"
    ]
  },
  administrativo: {
    title: "Serviços Administrativos",
    description: "Soluções corporativas e individuais em órgãos públicos, cuidando de toda a parte burocrática e documental com segurança jurídica.",
    items: [
      "Protocolos administrativos diversos em repartições públicas",
      "Elaboração de requerimentos formais fundamentados",
      "Consultoria administrativa documental preventiva",
      "Análise minuciosa de documentos e certidões"
    ]
  }
};

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Primeiro Contato",
    description: "Você entra em contato pelo WhatsApp, e-mail ou formulário contando sua necessidade.",
    icon: MessageSquare
  },
  {
    step: "2",
    title: "Análise Técnica",
    description: "Nossos especialistas analisam detalhadamente sua situação, documentos e viabilidade de recurso.",
    icon: Search
  },
  {
    step: "3",
    title: "Orçamento Transparente",
    description: "Enviamos uma proposta personalizada com valor justo e condições de pagamento facilitadas.",
    icon: FileText
  },
  {
    step: "4",
    title: "Envio de Documentos",
    description: "Você nos envia a documentação de forma 100% digital e segura diretamente pelo celular.",
    icon: Shield
  },
  {
    step: "5",
    title: "Protocolo Ágil",
    description: "Redigimos e protocolamos seu recurso ou requerimento fundamentado no respectivo órgão público.",
    icon: Award
  },
  {
    step: "6",
    title: "Acompanhamento Total",
    description: "Monitoramos seu processo diariamente até a decisão final e notificamos você a cada atualização.",
    icon: Clock
  }
];

const DIFFERENTIALS = [
  { title: "Atendimento 100% Online", description: "Atendemos clientes de todos os estados do Brasil sem que precisem sair de casa.", icon: Sliders },
  { title: "Transparência Absoluta", description: "Clareza em relação às chances do recurso e prestação de contas de cada etapa.", icon: Shield },
  { title: "Atendimento Humanizado", description: "Ouvimos seu caso com empatia e respeito, tratando você como prioridade.", icon: UserCheck },
  { title: "Agilidade Comprovada", description: "Prazos rápidos na elaboração e protocolo dos seus requerimentos.", icon: Clock },
  { title: "Segurança de Dados", description: "Tratamento de documentos sensíveis com total sigilo e em conformidade com a LGPD.", icon: Lock },
  { title: "Monitoramento Constante", description: "Busca ativa diária para garantir que nenhum prazo seja perdido pelos órgãos públicos.", icon: CheckCircle2 }
];

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    question: "Posso resolver todo o meu processo de forma 100% online?",
    answer: "Sim! Hoje todos os processos perante o INSS (via Meu INSS) e a maioria dos órgãos de trânsito (como DETRANs e JARI) são digitais. Coletamos sua assinatura digital e os documentos necessários de forma prática pelo celular. Você não precisa se deslocar nem pegar filas."
  },
  {
    id: "faq-2",
    question: "Quanto tempo demora para meu recurso ser elaborado e protocolado?",
    answer: "Após o recebimento de toda a documentação solicitada e confirmação do pagamento, nossa equipe elabora e protocoliza seu recurso ou requerimento administrativo em um prazo de 2 a 5 dias úteis."
  },
  {
    id: "faq-3",
    question: "Como funciona o pagamento dos serviços?",
    answer: "Trabalhamos com formas de pagamento flexíveis para melhor atender você. Aceitamos PIX, transferência bancária e parcelamento no cartão de crédito. Fornecemos contrato de prestação de serviços administrativo para sua segurança."
  },
  {
    id: "faq-4",
    question: "Vocês garantem o resultado positivo do processo?",
    answer: "Perante as leis brasileiras, a decisão final sobre qualquer recurso administrativo é de competência exclusiva do órgão julgador (como o conselho de recursos do INSS ou a JARI). No entanto, garantimos aplicar a melhor técnica jurídica, jurisprudência recente e fundamentação personalizada para maximizar suas chances de êxito."
  },
  {
    id: "faq-5",
    question: "Quais documentos são necessários para iniciar o meu atendimento?",
    answer: "Varia de acordo com o serviço. Para INSS, geralmente CPF, comprovante de residência e extrato CNIS ou carta de indeferimento. Para trânsito, a CNH e a notificação de autuação da multa. Nossa equipe indicará a lista exata após a pré-análise do caso."
  }
];

const BLOG_POSTS: BlogPost[] = [
  {
    id: "post-1",
    title: "Como Recorrer de uma Multa de Trânsito Indevida Passo a Passo",
    category: "Trânsito",
    date: "05 de Julho, 2026",
    readTime: "5 min de leitura",
    summary: "Entenda as etapas fundamentais para estruturar uma defesa prévia e recursos perante a JARI e o CETRAN.",
    content: "Muitos condutores acreditam que recorrer de uma multa de trânsito é perda de tempo, mas isso é um mito. Erros formais cometidos pelo agente de trânsito ou pelo órgão autuador são muito comuns e anulam a infração na hora.\n\nPara recorrer, primeiro fique atento à data limite expressa na Notificação de Autuação para apresentar a Defesa Prévia. Se houver falhas no preenchimento da autuação (como data errada, endereço inexistente ou ausência de informações obrigatórias do veículo), a multa deve ser arquivada.\n\nSe a defesa prévia for indeferida, o próximo passo é o Recurso em 1ª Instância para a JARI (Junta Administrativa de Recursos de Infrações). Nesta fase, deve-se discutir o mérito da infração com base no Código de Trânsito Brasileiro (CTB). Por fim, se necessário, há a 2ª Instância junto ao CETRAN. Conte com uma assessoria especializada para redigir sua defesa técnica e aumentar drasticamente suas chances de anular multas ou pontuações que ameaçam sua CNH.",
    imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "post-2",
    title: "Entenda o BPC/LOAS: Quem Tem Direito e Como Funciona a Solicitação",
    category: "INSS",
    date: "28 de Junho, 2026",
    readTime: "6 min de leitura",
    summary: "Descubra os requisitos de renda e deficiência para requerer o Benefício de Prestação Continuada diretamente no INSS.",
    content: "O Benefício de Prestação Continuada (BPC), regulamentado pela Lei Orgânica da Assistência Social (LOAS), garante um salário mínimo mensal para pessoas com deficiência de qualquer idade ou para idosos a partir de 65 anos.\n\nPara ter direito ao BPC, o requisito chave é que a renda por pessoa do grupo familiar seja igual ou inferior a 1/4 do salário mínimo vigente. Além disso, é obrigatório estar inscrito no Cadastro Único (CadÚnico) e manter os dados atualizados nos últimos dois anos.\n\nNo caso da pessoa com deficiência, haverá avaliação médica e social realizada por peritos do INSS para comprovar o impedimento de longo prazo (mínimo de 2 anos). Caso seu benefício seja indeferido pelo INSS sob a alegação de renda superior ou ausência de deficiência, saiba que é possível ingressar com recurso administrativo fundamentado demonstrando despesas com medicamentos e a real vulnerabilidade social, sem precisar de ação judicial imediata.",
    imageUrl: "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "post-3",
    title: "Guia Prático: Como Acompanhar seu Processo Administrativo no INSS",
    category: "INSS",
    date: "15 de Junho, 2026",
    readTime: "4 min de leitura",
    summary: "Veja como utilizar o portal Meu INSS de forma eficiente para monitorar exigências e prazos de análise.",
    content: "Acompanhar de perto o andamento do seu requerimento no INSS é crucial para evitar o arquivamento do processo por perda de prazos. Sempre que o INSS necessitar de mais documentos, ele emitirá uma 'Exigência'.\n\nVocê pode acompanhar tudo pelo aplicativo ou site 'Meu INSS' na seção 'Consultar Pedidos'. Ao clicar no seu processo, você poderá ver o histórico de movimentações e baixar a cópia do processo administrativo completo em PDF.\n\nSe o status estiver 'Em exigência', você terá um prazo (geralmente de 30 dias) para anexar os documentos solicitados. O não cumprimento da exigência no prazo legal resulta no indeferimento ou arquivamento do seu pedido. Caso encontre dificuldades em organizar os documentos corretos, uma assessoria administrativa especializada pode realizar todo o protocolo e anexação das provas de maneira técnica, garantindo a análise correta pelo analista do INSS.",
    imageUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "post-4",
    title: "Direitos do Cidadão contra Abusos de Órgãos Públicos",
    category: "Direitos",
    date: "02 de Junho, 2026",
    readTime: "4 min de leitura",
    summary: "Seus direitos fundamentais previstos na Lei do Processo Administrativo Federal (Lei 9.784/99).",
    content: "A administração pública deve pautar seus atos sob os princípios da legalidade, impessoalidade, moralidade, publicidade e eficiência. Todo cidadão tem o direito de ser tratado com respeito pelas autoridades e servidores públicos.\n\nA Lei nº 9.784/99 assegura que o cidadão tem o direito de ter ciência da tramitação dos processos administrativos em que tenha a condição de interessado, ter vista dos autos no órgão público, obter cópias de documentos e apresentar alegações e provas antes de qualquer decisão.\n\nAlém disso, os órgãos públicos possuem prazos legais rígidos para responder aos seus pedidos. A demora excessiva e injustificada na análise de uma aposentadoria ou licença viola o princípio da eficiência, gerando direito a reclamações na Ouvidoria, recursos de mora administrativa ou mandados de segurança administrativa. Conhecer seus direitos é a maior arma contra a burocracia estatal indevida.",
    imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80"
  }
];

const INITIAL_REVIEWS: Review[] = [
  {
    id: "rev-1",
    author: "Carlos Alberto de Souza",
    stars: 5,
    date: "14 de Junho, 2026",
    serviceType: "Recurso de CNH Suspensa",
    text: "Excelente assessoria! Estava prestes a perder minha CNH por excesso de pontos e preciso dela para trabalhar. Fizeram uma defesa técnica fantástica e conseguimos anular o processo de suspensão de forma totalmente administrativa. Super recomendo a SP Assessoria."
  },
  {
    id: "rev-2",
    author: "Maria de Lourdes Silva",
    stars: 5,
    date: "29 de Maio, 2026",
    serviceType: "BPC / LOAS",
    text: "Tive meu pedido de BPC negado pelo INSS por causa de um detalhe no Cadastro Único. A SP Assessoria fez uma análise de todos os meus papéis, reuniu as receitas médicas, montou o recurso certinho e em menos de 45 dias meu benefício foi aprovado! Gratidão imensa pelo carinho e rapidez."
  },
  {
    id: "rev-3",
    author: "Roberto Mendes Filho",
    stars: 5,
    date: "11 de Abril, 2026",
    serviceType: "Recurso de Multa Gravíssima",
    text: "Fui multado injustamente por uma infração que não cometi na rodovia. A equipe da SP preparou o recurso administrativo apontando erros no radar e o CETRAN deu provimento ao meu recurso. Transparência nota 10."
  }
];

// Seeded mock client tracking protocols for interactive feature
const MOCK_PROTOCOLS: Record<string, ProcessStatus> = {
  "SP-2026-402": {
    protocol: "SP-2026-402",
    clientName: "João Ricardo P. Cavalcanti",
    service: "Recurso de Cassação de CNH",
    currentStep: "Recurso Protocolado - Aguardando Julgamento",
    lastUpdate: "07 de Julho, 2026 às 14:30",
    timeline: [
      { title: "Atendimento Inicial & Contrato", status: "completed", date: "22/06/2026", description: "Entrada em contato, assinatura da assessoria e envio dos documentos de CNH digitalmente." },
      { title: "Análise Documental concluída", status: "completed", date: "24/06/2026", description: "Nossos analistas identificaram inconsistências formais no processo de cassação do DETRAN." },
      { title: "Elaboração do Recurso Técnico", status: "completed", date: "26/06/2026", description: "Recurso administrativo estruturado com base no artigo 265 do CTB e jurisprudências do CETRAN." },
      { title: "Protocolado junto ao Órgão Julgador", status: "completed", date: "29/06/2026", description: "Recurso devidamente protocolado de forma online no DETRAN de São Paulo." },
      { title: "Julgamento da JARI/CETRAN", status: "current", description: "Processo aguardando a pauta de julgamento dos conselheiros administrativos. Estamos monitorando semanalmente." },
      { title: "Decisão Final & Baixa de Bloqueio", status: "pending", description: "Aplicação da decisão favorável e liberação definitiva do prontuário." }
    ]
  },
  "SP-2026-892": {
    protocol: "SP-2026-892",
    clientName: "Antônia Cleide de Oliveira",
    service: "Recurso Administrativo de BPC/LOAS",
    currentStep: "Análise de Provas Sociais Adicionais",
    lastUpdate: "05 de Julho, 2026 às 11:15",
    timeline: [
      { title: "Atendimento Inicial & Cadastro", status: "completed", date: "28/05/2026", description: "Entrada com análise da carta de indeferimento do INSS por renda per capita familiar." },
      { title: "Auditoria Socioeconômica", status: "completed", date: "02/06/2026", description: "Levantamento de receitas, gastos com remédios e fraldas para desconto do cálculo de renda." },
      { title: "Protocolo do Recurso no INSS", status: "completed", date: "09/06/2026", description: "Recurso interposto perante a Junta de Recursos da Previdência Social demonstrando extrema vulnerabilidade." },
      { title: "Distribuição e Relatoria do Processo", status: "completed", date: "18/06/2026", description: "Processo distribuído para o conselheiro relator da 4ª Junta de Recursos." },
      { title: "Aguardando Parecer Técnico", status: "current", description: "Análise do parecer técnico de assistente social do INSS sobre os laudos de saúde enviados." },
      { title: "Julgamento e Concessão", status: "pending", description: "Julgamento colegiado do recurso previdenciário e implantação do benefício." }
    ]
  }
};

export default function App() {
  // Dynamic Site Data State with localStorage fallback for static hosting
  const [siteData, setSiteData] = useState<any>(() => {
    const saved = localStorage.getItem("sp_site_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultSiteData;
      }
    }
    return defaultSiteData;
  });
  const [adminOpen, setAdminOpen] = useState(false);

  const fetchSiteData = async () => {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : (localStorage.getItem("custom_session_token") || "");
      const headers: Record<string, string> = {};
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }
      const response = await fetch("/api/site-data", {
        headers
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setSiteData(data);
          localStorage.setItem("sp_site_data", JSON.stringify(data));
        }
      }
    } catch (error) {
      console.warn("Erro ao buscar dados do servidor, usando dados locais:", error);
    }
  };

  const saveSiteData = async (newData: any) => {
    try {
      localStorage.setItem("sp_site_data", JSON.stringify(newData));
      setSiteData(newData);
      
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const response = await fetch("/api/site-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(newData)
      });
      if (response.ok) {
        return true;
      }
      return true; // Return true because it's locally saved
    } catch (error) {
      console.warn("Erro ao salvar dados no servidor, mantendo localmente:", error);
      return true; // Return true because it's locally saved
    }
  };

  useEffect(() => {
    fetchSiteData();
  }, [adminOpen]);

  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"inss" | "transito" | "administrativo">("inss");

  // Accordion state
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  // Portal do cliente states
  const [trackingProtocol, setTrackingProtocol] = useState("");
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [searchingTracking, setSearchingTracking] = useState(false);
  const [sendingTrackingEmail, setSendingTrackingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [trackingEmailError, setTrackingEmailError] = useState("");

  // Blog modal states
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  // Reviews states
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [newAuthor, setNewAuthor] = useState("");
  const [newStars, setNewStars] = useState(5);
  const [newService, setNewService] = useState("INSS");
  const [newText, setNewText] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Budget Modal state
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);

  // WhatsApp Lead Capture Modal state
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  // Legal Modal states
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<"privacy" | "terms">("privacy");

  // Contact Form states
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactService, setContactService] = useState("Geral");
  const [contactMessage, setContactMessage] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  // Derive dynamic configuration with robust fallback
  const servicesData = siteData?.services || SERVICES;
  const activeService = servicesData[activeTab] || SERVICES[activeTab];
  
  const faqsData = siteData?.faqs || FAQS;
  const blogPostsData = siteData?.blogPosts || BLOG_POSTS;
  const siteConfigData = siteData?.siteConfig || {
    phone: "5511987049051",
    phoneAux: "5511993344293",
    email: "contato@spassessoria.com.br",
    cnpj: "67.851.115/0001-60",
    instagram: "spra.assessoria",
    heroTitle: "SP Assessoria de",
    heroTitleAccent: "Recursos Administrativos",
    heroSubtitle: "Soluções administrativas com agilidade, segurança e compromisso.",
    heroDescription: "Nascemos para oferecer um atendimento técnico especializado de ponta na via extrajudicial perante repartições federais, estaduais e municipais."
  };

  // Sync reviews state with siteData when loaded
  useEffect(() => {
    if (siteData && siteData.reviews) {
      setReviews(siteData.reviews);
    }
  }, [siteData]);

  // Real-time tracking query from dynamic database API
  const handleTrackingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError("");
    setTrackingResult(null);
    setSearchingTracking(true);
    setEmailConfirmOpen(false);
    setEmailSentSuccess(false);
    setTrackingEmailError("");

    const code = trackingProtocol.trim();
    if (!code) {
      setSearchingTracking(false);
      return;
    }

    try {
      const response = await fetch(`/api/tracking?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao consultar o processo.");
      }

      setTrackingResult(data);
    } catch (err: any) {
      setTrackingError(err.message || "Não foi possível localizar o andamento para o documento ou código informado.");
    } finally {
      setSearchingTracking(false);
    }
  };

  // Triggers server-side email dispatch with confirmation state
  const handleSendTrackingEmail = async () => {
    if (!trackingResult || !trackingResult.protocol) return;
    setSendingTrackingEmail(true);
    setTrackingEmailError("");

    try {
      const response = await fetch("/api/send-tracking-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ protocol: trackingResult.protocol })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao solicitar o envio do e-mail.");
      }

      setEmailSentSuccess(true);
      setTimeout(() => {
        setEmailConfirmOpen(false);
        setEmailSentSuccess(false);
      }, 5000);
    } catch (err: any) {
      setTrackingEmailError(err.message || "Não foi possível estabelecer conexão para enviar o e-mail.");
    } finally {
      setSendingTrackingEmail(false);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError("");
    setReviewSuccess(false);

    if (!newAuthor.trim() || !newText.trim() || !newEmail.trim() || !newPhone.trim()) {
      setReviewError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    // Client-side Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setReviewError("Por favor, insira um endereço de e-mail válido.");
      return;
    }

    // Client-side Phone validation
    const sanitizedPhone = newPhone.replace(/\D/g, "");
    if (sanitizedPhone.length < 8) {
      setReviewError("Por favor, insira um telefone/WhatsApp válido com DDD.");
      return;
    }

    setSubmittingReview(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          author: newAuthor.trim(),
          stars: newStars,
          serviceType: newService,
          text: newText.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar a avaliação.");
      }

      setNewAuthor("");
      setNewEmail("");
      setNewPhone("");
      setNewText("");
      setNewStars(5);
      setReviewSuccess(true);
      
      // Re-fetch site data to sync the UI in case the admin is viewing
      fetchSiteData();
    } catch (err: any) {
      setReviewError(err.message || "Ocorreu um erro ao enviar sua avaliação. Tente novamente mais tarde.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone) return;

    // Honeypot bot protection
    if (contactWebsite) {
      console.warn("Spam check triggered");
      setContactSuccess(true);
      return;
    }

    const payload = {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
      service: contactService,
      message: contactMessage,
      type: "Contato",
      lgpdConsent: true,
      website: contactWebsite
    };

    // Submit lead to our secure database API
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .catch(err => console.warn("Erro ao registrar lead de contato no servidor:", err));

    setContactSuccess(true);
    
    // Clear form
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setContactMessage("");
    setContactWebsite("");

    const phone = siteConfigData.phone;
    const text = `Olá SP Assessoria, acabo de enviar meu contato pelo formulário do site:\n\n*Nome:* ${contactName}\n*E-mail:* ${contactEmail || "Não informado"}\n*Telefone:* ${contactPhone}\n*Área de Interesse:* ${contactService}\n*Mensagem:* ${contactMessage || "Sem mensagem"}`;
    const encoded = encodeURIComponent(text);
    
    // Auto open WhatsApp in 1.5 seconds so they see success first
    setTimeout(() => {
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`, "_blank");
    }, 1500);
  };

  const handleWhatsAppDirect = (p: "primary" | "secondary" = "primary") => {
    setWhatsAppModalOpen(true);
  };

  const handleSocialClick = (platform: "instagram") => {
    if (platform === "instagram") {
      window.open(`https://instagram.com/${siteConfigData.instagram}`, "_blank");
    }
  };

  const openLegal = (type: "privacy" | "terms") => {
    setLegalModalType(type);
    setLegalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#fafafb] text-gray-800 font-sans relative overflow-x-hidden selection:bg-brand-gold-500 selection:text-brand-navy-950">
      
      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            {/* Logo and Brand Title */}
            <a href="#" className="flex flex-row items-center gap-3.5 sm:gap-4.5 group focus:outline-hidden">
              <div className="flex items-center justify-center shrink-0">
                <Logo logoUrl={siteConfigData.logoUrl} iconClassName="w-14 h-14 sm:w-16 sm:h-16 shadow-md" />
              </div>
              <div className="flex flex-col text-left justify-center gap-1 sm:gap-1.5 py-0.5">
                <span className="text-brand-navy-900 font-serif font-bold text-xl sm:text-2xl tracking-wide group-hover:text-brand-gold-500 transition-colors leading-none">
                  SP Assessoria
                </span>
                <span className="text-[8.5px] sm:text-[10px] uppercase tracking-[0.22em] text-gray-500 font-sans font-semibold leading-none">
                  Recursos Administrativos
                </span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#quem-somos" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Quem Somos</a>
              <a href="#servicos" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Serviços</a>
              <a href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Como Funciona</a>
              <a href="#solicitar-recurso" className="text-sm font-bold text-brand-gold-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Abrir Solicitação</a>
              <a href="#portal-cliente" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Área do Cliente</a>
              <a href="#perguntas-frequentes" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Dúvidas</a>
              <a href="#blog" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Blog</a>
              <a href="#contato" className="text-sm font-medium text-gray-600 hover:text-brand-navy-900 transition-colors focus:outline-hidden">Contato</a>
            </nav>

            {/* CTA Header Action */}
            <div className="hidden lg:flex items-center gap-4">
              <button
                id="header-budget-btn"
                onClick={() => setBudgetModalOpen(true)}
                className="px-5 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-semibold text-sm rounded-lg transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
              >
                Solicitar Orçamento
              </button>
            </div>

            {/* Mobile Hamburger toggle */}
            <div className="md:hidden">
              <button
                id="mobile-menu-toggle-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-500 hover:text-brand-navy-900 hover:bg-gray-100 rounded-lg focus:outline-hidden"
                aria-label="Menu principal"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-6 space-y-2 animate-fade-in shadow-md">
            <a 
              href="#quem-somos" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Quem Somos
            </a>
            <a 
              href="#servicos" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Serviços
            </a>
            <a 
              href="#como-funciona" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Como Funciona
            </a>
            <a 
              href="#portal-cliente" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Área do Cliente (Acompanhar Processo)
            </a>
            <a 
              href="#perguntas-frequentes" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Dúvidas Frequentes
            </a>
            <a 
              href="#blog" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Blog & Notícias
            </a>
            <a 
              href="#contato" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-navy-900 transition-all"
            >
              Contato
            </a>
            <div className="pt-4 flex flex-col gap-2">
              <button
                id="mobile-budget-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setBudgetModalOpen(true);
                }}
                className="w-full text-center py-2.5 bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                Solicitar Orçamento
              </button>
              <button
                id="mobile-whatsapp-cta-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleWhatsAppDirect("primary");
                }}
                className="w-full text-center py-2.5 bg-[#128c7e] hover:bg-[#075e54] text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Falar com Especialista
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 1. HERO SECTION (HOME) */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-36 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero text */}
            <div className="lg:col-span-7 text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#1a3562]/5 border border-[#1a3562]/10 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-gold-500" />
                <span className="text-xs text-brand-navy-700 font-semibold tracking-wide uppercase font-mono">
                  Assessoria Extrajudicial Especializada
                </span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-brand-navy-900 leading-[1.15] tracking-tight">
                SP Assessoria de Recursos <span className="text-brand-gold-500">Administrativos</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 font-sans font-light leading-relaxed max-w-2xl">
                “Soluções administrativas com agilidade, segurança e compromisso.”
              </p>

              <p className="text-sm text-gray-500 leading-relaxed font-normal">
                Recursos contra negativas do INSS, defesas de pontuação e suspensão de CNH, e requerimentos administrativos em órgãos públicos federais, estaduais e municipais.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  id="hero-whatsapp-btn"
                  onClick={() => handleWhatsAppDirect("primary")}
                  className="px-8 py-4 bg-[#128c7e] hover:bg-[#075e54] text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer text-base"
                >
                  <MessageSquare className="w-5 h-5 fill-white" />
                  <span>Falar com Especialista via WhatsApp</span>
                </button>
                
                <button
                  id="hero-budget-btn"
                  onClick={() => setBudgetModalOpen(true)}
                  className="px-8 py-4 bg-white hover:bg-gray-50 border border-gray-200 text-brand-navy-900 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer text-base shadow-xs"
                >
                  <span>Simular Orçamento</span>
                  <ArrowRight className="w-4 h-4 text-brand-gold-500" />
                </button>
              </div>

              {/* Security notice / Disclaimer badge */}
              <div className="flex items-start gap-3 text-xs text-gray-500 bg-white p-4 rounded-xl border border-gray-100 max-w-xl mt-4 shadow-xs">
                <Info className="w-5 h-5 text-brand-gold-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Atuação técnica extrajudicial:</strong> Defesas formuladas por analistas e assessores especializados na via administrativa. Sem litígios judiciais ou atos restritos à advocacia privada.
                </span>
              </div>
            </div>

            {/* Hero image and trust badge */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="relative w-full max-w-md">
                
                {/* Professional administrative/legal themed image */}
                <div className="relative rounded-2xl border border-gray-100 overflow-hidden shadow-lg bg-white p-2">
                  <img
                    src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80"
                    alt="Processos Administrativos e Direito Administrativo"
                    className="w-full h-80 object-cover object-center rounded-xl filter brightness-95 hover:scale-102 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-xl" />
                  
                  {/* Embedded Floating card */}
                  <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/95 backdrop-blur-xs border border-gray-100 rounded-xl shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600 shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[9px] text-gray-400 uppercase tracking-wider font-mono font-bold">SP ASSESSORIA</span>
                        <span className="text-sm font-bold text-brand-navy-900">Análise Preliminar Sem Custo</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating trust shield badge */}
                <div className="absolute -top-4 -right-4 p-4 bg-white border border-gray-100 rounded-xl shadow-md flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-brand-gold-600 animate-pulse" />
                  <div className="text-left font-sans">
                    <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-semibold leading-none">Processos</span>
                    <span className="text-xs font-bold text-brand-navy-900">100% Seguros</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="bg-white border-y border-gray-100 py-10 relative shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <span className="block text-3xl md:text-4xl font-display font-extrabold text-brand-gold-600">98.4%</span>
              <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase font-mono mt-1 block">Casos Resolvidos</span>
            </div>
            <div>
              <span className="block text-3xl md:text-4xl font-display font-extrabold text-brand-gold-600">2 a 5d</span>
              <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase font-mono mt-1 block">Elaboração Rápida</span>
            </div>
            <div>
              <span className="block text-3xl md:text-4xl font-display font-extrabold text-brand-gold-600">100%</span>
              <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase font-mono mt-1 block">Online & Digital</span>
            </div>
            <div>
              <span className="block text-2xl md:text-3xl font-display font-extrabold text-brand-navy-900">CNPJ Ativo</span>
              <span className="text-[11px] text-gray-400 font-mono mt-1.5 block">67.851.115/0001-60</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUEM SOMOS */}
      <section id="quem-somos" className="py-24 relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Visual Column - Stacked with high-quality consulting image and commitments */}
            <div className="lg:col-span-5 space-y-6 order-last lg:order-first">
              
              {/* Professional Corporate Consultation Image Card */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-150 shadow-md bg-white p-2">
                <img
                  src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80"
                  alt="Assessoria e Planejamento Administrativo"
                  className="w-full h-44 object-cover rounded-xl filter brightness-95"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-xl" />
                <div className="absolute bottom-4 left-4 text-left">
                  <span className="text-[9px] uppercase tracking-widest font-mono text-brand-gold-400 font-bold">SP ASSESSORIA</span>
                  <h4 className="text-xs font-bold text-white">Análise Consultiva e Transparência</h4>
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-white p-6 shadow-xs">
                <div className="absolute top-0 right-0 p-4">
                  <Scale className="w-24 h-24 text-brand-gold-500/5 rotate-12" />
                </div>
                
                <h4 className="text-base font-display font-bold text-brand-navy-900 mb-4">Nossos Compromissos</h4>
                
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-brand-gold-500/10 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-brand-navy-900 text-xs font-bold">Transparência Integral:</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">Se o recurso não for viável administrativamente, informamos antes de contratar.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-brand-gold-500/10 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-brand-navy-900 text-xs font-bold">Atendimento Humanizado:</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">Acompanhamento focado e respostas rápidas e claras para sua tranquilidade.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-brand-gold-500/10 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-brand-navy-900 text-xs font-bold">Rigor Técnico:</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">Fundamentamos cada defesa com jurisprudências atualizadas dos colegiados.</p>
                    </div>
                  </li>
                </ul>

                {/* Simulated Signature */}
                <div className="border-t border-gray-100 mt-5 pt-3 flex justify-between items-center text-[10px] text-gray-400">
                  <span>Atendimento em todo o Brasil</span>
                  <span className="font-mono text-[9px] text-brand-gold-600 font-bold">SPRA Assessoria</span>
                </div>
              </div>
            </div>

            {/* Narrative Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">História & Compromisso</span>
              <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">
                Quem Somos
              </h2>
              
              <div className="space-y-4 text-gray-600 font-sans leading-relaxed text-base">
                <p>
                  A <strong>SP Assessoria de Recursos Administrativos</strong> nasceu para oferecer atendimento personalizado e eficiente na área administrativa, auxiliando pessoas físicas e empresas na solução de processos junto aos órgãos públicos. Nosso compromisso primordial é prestar um serviço transparente, ágil e responsável.
                </p>
                <p>
                  Sabemos o quanto a burocracia do Estado pode ser exaustiva e complexa, seja para recuperar um benefício do INSS cortado injustamente, ou para recorrer de uma multa de trânsito arbitrária que coloca em risco sua habilitação. Por isso, oferecemos uma alternativa focada na via extrajudicial, poupando tempo, desgaste e custos excessivos.
                </p>
                <p>
                  Com um método focado 100% digital, atendemos clientes de todos os cantos do Brasil por meio de ferramentas ágeis, desmistificando o processo de assessoria técnica, com integridade e em total conformidade com as diretrizes da LGPD.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-brand-gold-600" />
                  <span className="text-xs font-semibold text-brand-navy-900">CNPJ Regularizado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-gold-600" />
                  <span className="text-xs font-semibold text-brand-navy-900">Foco no Cidadão</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. SERVIÇOS SECTION */}
      <section id="servicos" className="py-24 bg-[#f4f6f8] border-y border-gray-100 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">O que Fazemos</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Nossas Áreas de Atuação</h2>
            <p className="text-sm md:text-base text-gray-600">
              Oferecemos serviços especializados focados exclusivamente na esfera administrativa, agilizando requerimentos e montando defesas com fundamentação profissional.
            </p>
          </div>

          {/* Service Selector Tabs */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-10 max-w-3xl mx-auto border-b border-gray-200 pb-4">
            <button
              id="tab-inss"
              onClick={() => setActiveTab("inss")}
              className={`px-4 sm:px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "inss"
                  ? "bg-brand-navy-900 text-white font-bold shadow-xs"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-brand-navy-900 hover:bg-gray-50"
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>INSS & Previdenciário</span>
            </button>
            
            <button
              id="tab-transito"
              onClick={() => setActiveTab("transito")}
              className={`px-4 sm:px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "transito"
                  ? "bg-brand-navy-900 text-white font-bold shadow-xs"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-brand-navy-900 hover:bg-gray-50"
              }`}
            >
              <Car className="w-4 h-4 shrink-0" />
              <span>Trânsito & CNH</span>
            </button>

            <button
              id="tab-admin"
              onClick={() => setActiveTab("administrativo")}
              className={`px-4 sm:px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "administrativo"
                  ? "bg-brand-navy-900 text-white font-bold shadow-xs"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-brand-navy-900 hover:bg-gray-50"
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Geral & Administrativo</span>
            </button>
          </div>

          {/* Active Tab Content Card */}
          <div className="max-w-4xl mx-auto bg-white border border-gray-150 rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 p-6 opacity-[0.01] pointer-events-none">
              {activeTab === "inss" && <Award className="w-48 h-48" />}
              {activeTab === "transito" && <Car className="w-48 h-48" />}
              {activeTab === "administrativo" && <Briefcase className="w-48 h-48" />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Side: Summary */}
              <div className="md:col-span-5 text-left space-y-4">
                <div className="w-12 h-12 bg-brand-gold-500/10 border border-brand-gold-500/20 rounded-xl flex items-center justify-center text-brand-gold-600">
                  {activeTab === "inss" && <Award className="w-6 h-6" />}
                  {activeTab === "transito" && <Car className="w-6 h-6" />}
                  {activeTab === "administrativo" && <Briefcase className="w-6 h-6" />}
                </div>
                <h3 className="text-2xl font-display font-bold text-brand-navy-900">{activeService.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{activeService.description}</p>
                
                <div className="pt-4">
                  <button
                    id={`budget-cta-active-${activeTab}`}
                    onClick={() => setBudgetModalOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold-600 hover:text-brand-gold-700 hover:underline cursor-pointer"
                  >
                    <span>Simular orçamento desta área</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Side: Bullet Items list with custom checkmarks */}
              <div className="md:col-span-7 bg-gray-50 border border-gray-100 rounded-xl p-6 space-y-3 text-left">
                <span className="text-xs font-mono uppercase tracking-widest text-brand-navy-900 block font-bold mb-2">Serviços Compreendidos</span>
                <div className="grid grid-cols-1 gap-3">
                  {activeService.items.map((item: string, index: number) => (
                    <div key={index} className="flex items-start gap-3 py-1.5 border-b border-gray-200/50 last:border-b-0">
                      <div className="mt-1 w-4 h-4 bg-brand-gold-500/10 border border-brand-gold-500/20 rounded-full flex items-center justify-center text-brand-gold-600 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. COMO FUNCIONA (STEP-BY-STEP) */}
      <section id="como-funciona" className="py-24 relative scroll-mt-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Processo Simplificado</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Como Funciona Nosso Atendimento</h2>
            <p className="text-sm md:text-base text-gray-600">
              Descomplicamos do início ao fim. Veja o caminho que seu recurso percorrerá até ser protocolado formalmente de forma transparente.
            </p>
          </div>

          {/* Timeline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white hover:bg-[#fafafb] border border-gray-150 hover:border-gray-200 rounded-xl p-8 text-left relative transition-all duration-300 group flex flex-col justify-between shadow-xs hover:shadow-md"
                >
                  <div>
                    {/* Number badge */}
                    <div className="absolute top-4 right-4 text-3xl font-display font-black text-brand-navy-900/5 group-hover:text-brand-gold-500/15 transition-colors">
                      {step.step}
                    </div>

                    <div className="w-10 h-10 bg-brand-gold-500/10 border border-brand-gold-500/20 rounded-lg flex items-center justify-center text-brand-gold-600 mb-4 group-hover:bg-brand-navy-900 group-hover:text-white transition-all duration-300">
                      <Icon className="w-5 h-5" />
                    </div>

                    <h3 className="text-lg font-display font-semibold text-brand-navy-900 mb-2">
                      {step.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
                      {step.description}
                    </p>
                  </div>

                  {/* Connect arrow helper for desktops */}
                  <div className="mt-6 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <span>Etapa {step.step} concluída online</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* CLIENT PORTAL: Interactive mock process tracker */}
      <section id="portal-cliente" className="py-24 bg-[#f4f6f8] border-y border-gray-100 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Explanatory text */}
            <div className="lg:col-span-5 text-left space-y-6">
              <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Inovação & Rastreabilidade</span>
              <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Consulte seu Processo em Tempo Real</h2>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                Nossos clientes não ficam no escuro. Criamos esta área dedicada para que você monitore com total transparência e segurança cada etapa do seu requerimento administrativo direto de nosso portal de acompanhamento.
              </p>
              <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex gap-3 items-start">
                  <span className="p-2 bg-brand-gold-100 text-brand-gold-800 rounded-lg text-xs font-bold">1</span>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Insira o seu <strong>CPF</strong> ou código de <strong>Protocolo</strong> no formulário ao lado.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="p-2 bg-brand-gold-100 text-brand-gold-800 rounded-lg text-xs font-bold">2</span>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Acompanhe instantaneamente os trâmites, os documentos vinculados e o status revisional atualizado.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="p-2 bg-brand-gold-100 text-brand-gold-800 rounded-lg text-xs font-bold">3</span>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Caso prefira, envie o relatório atualizado diretamente para o seu e-mail cadastrado com apenas um clique de forma segura.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive portal search */}
            <div className="lg:col-span-7 bg-white border border-gray-150 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <h3 className="text-lg font-display font-semibold text-brand-navy-900 mb-4 text-left flex items-center gap-2">
                <Search className="w-5 h-5 text-brand-gold-600 animate-pulse" />
                <span>Portal de Acompanhamento SP</span>
              </h3>

              <form onSubmit={handleTrackingSearch} className="flex flex-col sm:flex-row gap-2 mb-6">
                <input
                  type="text"
                  value={trackingProtocol}
                  onChange={(e) => setTrackingProtocol(e.target.value)}
                  placeholder="Informe seu CPF ou código do Protocolo..."
                  className="flex-1 bg-gray-50 border border-gray-250 rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white transition-all"
                  disabled={searchingTracking}
                />
                <button
                  type="submit"
                  id="search-protocol-btn"
                  disabled={searchingTracking}
                  className="px-6 py-3 bg-brand-navy-900 text-white font-bold text-sm rounded-lg hover:bg-brand-navy-800 transition-all cursor-pointer shadow-xs disabled:opacity-75 flex items-center justify-center gap-2"
                >
                  {searchingTracking ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <span>Consultar Andamento</span>
                  )}
                </button>
              </form>

              {/* Errors container */}
              {trackingError && (
                <div className="p-4 bg-red-50 border border-red-150 text-red-600 text-xs rounded-lg text-left mb-4">
                  {trackingError}
                </div>
              )}

              {/* Success Result Container */}
              {trackingResult && (
                <div className="space-y-4 animate-fade-in text-left">
                  {/* Process meta header */}
                  <div className="p-4 bg-gray-50 border-l-4 border-brand-gold-500 rounded-r-lg flex flex-col sm:flex-row justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-mono block">CLIENTE</span>
                      <strong className="text-brand-navy-900 text-sm">{trackingResult.clientName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-mono block">SERVIÇO</span>
                      <span className="text-gray-700 font-medium">{trackingResult.service}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-mono block">ÚLTIMA ATUALIZAÇÃO</span>
                      <span className="text-brand-gold-600 font-mono font-semibold">{trackingResult.lastUpdate}</span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="text-xs">
                    <span className="text-gray-500 font-semibold">STATUS ATUAL DO PROCESSO:</span>
                    <span className="ml-2 px-2.5 py-1 bg-brand-gold-100 border border-brand-gold-200 text-brand-gold-800 font-bold rounded-full uppercase text-[10px]">
                      {trackingResult.currentStep}
                    </span>
                  </div>

                  {/* Timeline representation */}
                  <div className="space-y-4 relative pl-4 border-l border-gray-200 ml-2 pt-2">
                    {trackingResult.timeline.map((item: any, index: number) => (
                      <div key={index} className="relative">
                        {/* Bullet point circle indicator */}
                        <div className={`absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                          item.status === "completed" 
                            ? "bg-brand-gold-500 border-brand-gold-500" 
                            : item.status === "current"
                              ? "bg-white border-brand-gold-500 animate-ping"
                              : "bg-white border-gray-300"
                        }`} />
                        
                        {/* Inner static marker for current */}
                        {item.status === "current" && (
                          <div className="absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-brand-gold-500 border-brand-gold-500" />
                        )}

                        <div className="text-xs text-left">
                          <div className="flex items-center gap-2">
                            <strong className={`font-semibold ${item.status === "completed" ? "text-gray-700" : item.status === "current" ? "text-brand-gold-600" : "text-gray-400"}`}>
                              {item.title}
                            </strong>
                            {item.date && (
                              <span className="text-[9px] font-mono text-gray-500 uppercase px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">
                                {item.date}
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-relaxed ${item.status === "pending" ? "text-gray-400" : "text-gray-500"}`}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Documents & Files Attached */}
                  {trackingResult.documents && trackingResult.documents.length > 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl text-xs space-y-2 mt-4">
                      <strong className="text-brand-navy-900 block font-display">Documentos Cadastrados / Anexados:</strong>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {trackingResult.documents.map((doc: any, idx: number) => {
                          const docName = typeof doc === "string" ? doc : (doc.name || "Documento");
                          const docUrl = typeof doc === "string" && (doc.startsWith("http") || doc.startsWith("data:")) ? doc : (doc.url || "");
                          return (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-200 text-gray-700 shadow-2xs">
                              <div className="flex items-center gap-2 truncate mr-2">
                                <FileText className="w-4 h-4 text-brand-gold-500 flex-shrink-0" />
                                <span className="truncate font-medium text-xs">{docName}</span>
                              </div>
                              {docUrl && (
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-brand-navy-900 text-white text-[10px] font-bold rounded-md hover:bg-brand-navy-800 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                >
                                  <span>Abrir</span>
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Order / Registration details */}
                  {trackingResult.orderInfo && (
                    <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl text-xs mt-2">
                      <strong className="text-brand-navy-900 block font-display mb-1">Informações de Registro & Pedido:</strong>
                      <p className="text-gray-600 leading-relaxed">{trackingResult.orderInfo}</p>
                    </div>
                  )}

                  {/* Send to E-mail control panel */}
                  <div className="mt-6 pt-4 border-t border-gray-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="text-xs text-left text-gray-500 max-w-sm">
                      Deseja receber este relatório completo de acompanhamento e documentos em seu e-mail cadastrado?
                    </div>
                    
                    {!emailConfirmOpen ? (
                      <button
                        type="button"
                        onClick={() => setEmailConfirmOpen(true)}
                        className="px-4 py-2.5 bg-brand-gold-500 hover:bg-brand-gold-600 text-brand-navy-900 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Enviar ao meu E-mail</span>
                      </button>
                    ) : (
                      <div className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
                        <div className="text-xs text-left text-gray-700">
                          Confirma o envio deste relatório para o endereço de e-mail de cadastro parcial abaixo?
                          <div className="mt-1.5 p-2 bg-white rounded border border-gray-200 font-mono text-brand-navy-900 font-semibold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            {trackingResult.maskedEmail || "seu******@email.com"}
                          </div>
                        </div>

                        {trackingEmailError && (
                          <div className="text-[11px] text-red-600 text-left font-semibold">
                            {trackingEmailError}
                          </div>
                        )}

                        {emailSentSuccess ? (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-800 text-[11px] rounded-lg text-left flex items-center gap-1.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>E-mail enviado com sucesso! Verifique sua caixa de entrada em alguns instantes.</span>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setEmailConfirmOpen(false);
                                setTrackingEmailError("");
                              }}
                              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold text-xs rounded-md hover:bg-gray-50 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={sendingTrackingEmail}
                              onClick={handleSendTrackingEmail}
                              className="px-4 py-1.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-md cursor-pointer flex items-center gap-1.5 disabled:opacity-75"
                            >
                              {sendingTrackingEmail ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  <span>Disparando...</span>
                                </>
                              ) : (
                                <span>Confirmar Envio</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Idle State helper */}
              {!trackingResult && !trackingError && (
                <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl text-xs space-y-2">
                  <HelpCircle className="w-8 h-8 text-brand-gold-500/20 mx-auto" />
                  <p>Digite seu CPF ou o código de protocolo para ver o demonstrativo do seu acompanhamento.</p>
                </div>
              )}

            </div>

          </div>
        </div>
      </section>

      {/* FORMULÁRIO PÚBLICO DE SOLICITAÇÃO DE RECURSO */}
      <section id="solicitar-recurso" className="py-16 bg-gray-50/80 border-y border-gray-150 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PublicRequestForm 
            onSuccessQueryProtocol={(protocol) => {
              setTrackingProtocol(protocol);
              const portalEl = document.getElementById("portal-cliente");
              if (portalEl) {
                portalEl.scrollIntoView({ behavior: "smooth" });
              }
            }} 
          />
        </div>
      </section>

      {/* 5. DIFERENCIAIS SECTION */}
      <section className="py-24 relative bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Por Que Nos Escolher</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Nossos Grandes Diferenciais</h2>
            <p className="text-sm md:text-base text-gray-600">
              Trabalhamos focados em simplificar o seu problema com presteza, segurança e integridade profissional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {DIFFERENTIALS.map((diff, index) => {
              const Icon = diff.icon;
              return (
                <div 
                  key={index}
                  className="p-6 bg-white border border-gray-150 hover:border-gray-300 rounded-xl text-left transition-colors group shadow-xs"
                >
                  <div className="w-10 h-10 bg-brand-gold-500/10 border border-brand-gold-500/20 rounded-lg flex items-center justify-center text-brand-gold-600 mb-4 group-hover:bg-brand-navy-900 group-hover:text-white transition-all duration-300">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-brand-navy-900 mb-2">{diff.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed font-sans">{diff.description}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 6. AVALIAÇÕES (CLIENT REVIEWS) */}
      <section className="py-24 bg-[#f4f6f8] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Depoimentos Reais</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">O Que Nossos Clientes Dizem</h2>
            <p className="text-sm md:text-base text-gray-600">
              Sua satisfação e segurança são nossa maior recompensa. Veja a opinião de quem já obteve soluções conosco.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Reviews list */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {reviews.filter((rev: any) => rev.approved !== false).map((rev: any, idx: number) => (
                  <div 
                    key={rev.id || `app-rev-${idx}`} 
                    className="p-6 bg-white border border-gray-150 rounded-xl text-left relative shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-brand-navy-900 text-sm">{rev.author}</h4>
                        <span className="text-[10px] text-brand-gold-600 font-mono tracking-wide font-semibold">
                          {rev.serviceType}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {rev.date}
                      </span>
                    </div>

                    {/* Star rating render */}
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: rev.stars }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-brand-gold-500 text-brand-gold-500" />
                      ))}
                    </div>

                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed italic">
                      "{rev.text}"
                    </p>
                  </div>
                ))}
                {reviews.filter((rev: any) => rev.approved !== false).length === 0 && (
                  <div className="p-12 text-center bg-white border border-gray-150 rounded-xl text-gray-400 text-xs">
                    <p>Nenhuma avaliação publicada ainda. Seja o primeiro a avaliar!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Leave a review box */}
            <div className="lg:col-span-5 bg-white border border-gray-150 rounded-2xl p-6 sm:p-8 text-left shadow-sm">
              <h3 className="text-lg font-display font-bold text-brand-navy-900 mb-1">Deixe Sua Avaliação</h3>
              <p className="text-xs text-gray-500 mb-6">
                Sua opinião nos ajuda a aprimorar nosso atendimento. Ela passará por uma revisão antes de ser publicada.
              </p>

              {reviewSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs rounded-xl text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 animate-pulse" />
                  <p className="font-bold text-sm text-emerald-900">Avaliação Enviada!</p>
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    Obrigado! Sua avaliação foi recebida com sucesso. Para manter a segurança da nossa página, sua avaliação será revisada por nossa equipe antes de ser publicada oficialmente.
                  </p>
                  <button
                    onClick={() => setReviewSuccess(false)}
                    className="mt-2 text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Enviar outra avaliação
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateReview} className="space-y-4">
                  {reviewError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{reviewError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Seu Nome Completo <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      placeholder="Ex: Carlos Mendes"
                      className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Seu E-mail <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Ex: carlos@gmail.com"
                        className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Telefone / WhatsApp <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        required
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Ex: (11) 99999-9999"
                        className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Área do Serviço </label>
                      <select
                        value={newService}
                        onChange={(e) => setNewService(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                      >
                        <option value="INSS Previdenciário">INSS</option>
                        <option value="Recurso de Multa">Trânsito</option>
                        <option value="Assessoria Geral">Administrativo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Classificação </label>
                      <select
                        value={newStars}
                        onChange={(e) => setNewStars(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                      >
                        <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                        <option value="4">⭐⭐⭐⭐ (Muito Bom)</option>
                        <option value="3">⭐⭐⭐ (Regular)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Seu Comentário <span className="text-red-500">*</span></label>
                    <textarea
                      required
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      rows={3}
                      placeholder="Conte brevemente sobre o seu processo e sua experiência conosco..."
                      className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white resize-none"
                    />
                  </div>

                  <div className="text-[10px] text-gray-400 font-medium leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                    ℹ️ <strong>Nota de Moderação:</strong> Para garantir a idoneidade dos depoimentos e evitar spam, coletamos seu e-mail e telefone para fins de validação interna. Suas informações de contato <strong>nunca</strong> serão exibidas no site ou compartilhadas com terceiros.
                  </div>

                  <button
                    type="submit"
                    id="submit-review-btn"
                    disabled={submittingReview}
                    className="w-full py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 disabled:bg-gray-400 text-white font-bold text-xs rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    {submittingReview ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Enviando avaliação...</span>
                      </>
                    ) : (
                      <span>Enviar Minha Avaliação</span>
                    )}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* 7. PERGUNTAS FREQUENTES */}
      <section id="perguntas-frequentes" className="py-24 relative scroll-mt-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Esclarecimentos</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Perguntas Frequentes</h2>
            <p className="text-sm text-gray-600">
              Caso sua dúvida não esteja respondida abaixo, entre em contato imediatamente com nossos assessores por e-mail ou WhatsApp.
            </p>
          </div>

          <div className="space-y-4">
            {faqsData.map((faq: any) => {
              const isOpen = openFaq === faq.id;
              return (
                <div 
                  key={faq.id} 
                  className="bg-white border border-gray-150 hover:border-gray-250 rounded-xl overflow-hidden transition-all duration-300 shadow-xs"
                >
                  <button
                    id={`toggle-${faq.id}`}
                    onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-hidden cursor-pointer"
                  >
                    <span className="font-display font-semibold text-brand-navy-900 text-sm sm:text-base pr-4">
                      {faq.question}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-brand-gold-600 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-brand-gold-600 shrink-0" />
                    )}
                  </button>

                  {/* Smooth transition content container */}
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-[#fafafb] whitespace-pre-line animate-fade-in text-left">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 8. BLOG & CONTEÚDOS */}
      <section id="blog" className="py-24 bg-[#f4f6f8] border-y border-gray-100 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Informativos Técnicos</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Nosso Blog de Direitos Administrativos</h2>
            <p className="text-sm md:text-base text-gray-600">
              Publicamos guias e orientações práticas para municiar o cidadão sobre seus direitos perante órgãos governamentais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {blogPostsData.map((post: any) => (
              <div 
                key={post.id}
                id={`blog-card-${post.id}`}
                onClick={() => setSelectedPost(post)}
                className="bg-white border border-gray-150 hover:border-gray-250 rounded-xl overflow-hidden text-left flex flex-col justify-between shadow-xs transition-all duration-300 cursor-pointer group hover:shadow-md"
              >
                <div>
                  <div className="relative h-40 overflow-hidden bg-gray-100">
                    <img 
                      src={post.imageUrl} 
                      alt={post.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 bg-white/95 border border-brand-gold-500/20 text-[9px] text-brand-gold-700 font-mono font-bold uppercase px-2.5 py-1 rounded-md shadow-xs">
                      {post.category}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-brand-gold-600" />
                        {post.date}
                      </span>
                    </div>

                    <h3 className="text-sm font-display font-bold text-brand-navy-900 group-hover:text-brand-gold-600 transition-colors line-clamp-2">
                      {post.title}
                    </h3>

                    <p className="text-[11px] text-gray-500 line-clamp-3">
                      {post.summary}
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-brand-gold-600 font-semibold uppercase tracking-wider">
                  <span>Ler Artigo Completo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* DECORATIVE SÃO PAULO CITY SKYLINE BANNER - HIGH IMAGE CONTENT */}
      <section className="relative py-28 overflow-hidden border-y border-brand-gold-500/20 bg-brand-navy-950">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1543059080-f092d068296e?auto=format&fit=crop&w=1600&q=80" 
            alt="São Paulo Skyline Sunset" 
            className="w-full h-full object-cover object-center opacity-25 filter brightness-50"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-navy-950 via-brand-navy-950/80 to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-2xl space-y-6">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-500 font-bold block">Presença Nacional • Sede em São Paulo</span>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white leading-tight">
              Sua Assessoria Administrativa em <span className="text-brand-gold-500">Qualquer Região</span> do Brasil
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-light">
              Nossa sede está localizada no coração da capital paulista, mas nossa operação é 100% digital e integrada por canais de alta velocidade. Peticionamos recursos e monitoramos exigências junto a repartições públicas federais, estaduais e municipais de qualquer município do país.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setBudgetModalOpen(true)}
                className="px-5 py-2.5 bg-brand-gold-500 hover:bg-brand-gold-400 text-brand-navy-950 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
              >
                Análise Gratuita de Viabilidade
              </button>
              <button
                onClick={() => handleWhatsAppDirect("primary")}
                className="px-5 py-2.5 bg-[#128c7e] hover:bg-[#075e54] text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Phone className="w-3.5 h-3.5 fill-white" />
                Falar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. CONTATO & LOCALIZAÇÃO */}
      <section id="contato" className="py-24 relative scroll-mt-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-brand-gold-600 font-bold block">Fale Conosco</span>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-900">Canais de Atendimento</h2>
            <p className="text-sm text-gray-600">
              Estamos disponíveis para atendê-lo online de segunda a sexta-feira, das 09h às 18h. Solicite sua pré-análise gratuita!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            {/* Direct info list */}
            <div className="lg:col-span-5 bg-[#f4f6f8] border border-gray-150 rounded-2xl p-6 sm:p-8 text-left space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy-900 mb-2">SP Assessoria</h3>
                <p className="text-xs text-gray-500 mb-6">
                  Inscrição CNPJ: <strong>67.851.115/0001-60</strong>. Representação e assistência no âmbito extrajudicial.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">WhatsApp Principal</span>
                      <button 
                        onClick={() => handleWhatsAppDirect("primary")}
                        className="text-brand-navy-900 hover:text-brand-gold-600 font-semibold text-sm transition-colors block cursor-pointer"
                      >
                        (11) 98704-9051
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">WhatsApp Auxiliar</span>
                      <button 
                        onClick={() => handleWhatsAppDirect("secondary")}
                        className="text-brand-navy-900 hover:text-brand-gold-600 font-semibold text-sm transition-colors block cursor-pointer"
                      >
                        (11) 99334-4293
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">E-mail de Contato</span>
                      <a 
                        href="mailto:atendimento.spassessoria@gmail.com"
                        className="text-brand-navy-900 hover:text-brand-gold-600 font-semibold text-sm transition-colors block"
                      >
                        atendimento.spassessoria@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">Área de Atendimento</span>
                      <span className="text-brand-navy-900 font-medium text-sm">
                        Sede em São Paulo - SP (Atendimento Digital Nacional)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instagram tag */}
              <div className="border-t border-gray-200 pt-6">
                <button
                  id="instagram-link-btn"
                  onClick={() => handleSocialClick("instagram")}
                  className="w-full py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 text-xs text-gray-600 hover:text-brand-navy-900 font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  Siga-nos no Instagram <strong>@spra.assessoria</strong>
                </button>
              </div>
            </div>

            {/* Simulated contact form */}
            <div className="lg:col-span-7 bg-white border border-gray-150 rounded-2xl p-6 sm:p-8 text-left shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-display font-bold text-brand-navy-900 mb-1">Inicie Seu Atendimento Online</h3>
                <p className="text-xs text-gray-500 mb-6">
                  Preencha os campos abaixo para pré-cadastro. Entraremos em contato com a pré-análise do seu caso pelo celular fornecido.
                </p>

                {contactSuccess ? (
                  <div className="p-6 bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs rounded-xl text-center space-y-3">
                    <CheckCircle2 className="w-8 h-8 mx-auto animate-pulse text-emerald-600" />
                    <h4 className="text-base font-bold text-emerald-900">Solicitação de Atendimento Enviada!</h4>
                    <p className="text-emerald-700">
                      Estamos abrindo uma conversa em nosso canal direto de WhatsApp para dar andamento imediato. Caso não abra automaticamente, por favor clique no botão abaixo.
                    </p>
                    <button
                      onClick={() => handleWhatsAppDirect("primary")}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Ir Para o WhatsApp</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Seu Nome Completo * </label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Ex: Pedro de Alcântara"
                          className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Seu E-mail (opcional) </label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="Ex: pedro@email.com"
                          className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> WhatsApp com DDD * </label>
                        <input
                          type="text"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="Ex: (11) 98765-4321"
                          className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Qual a Área do seu Problema? </label>
                        <select
                          value={contactService}
                          onChange={(e) => setContactService(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-2.5 text-xs text-gray-800 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        >
                          <option value="Geral">Assunto Geral</option>
                          <option value="INSS Previdenciário">INSS (BPC, Recursos, Exigências)</option>
                          <option value="Trânsito Multas">Trânsito (Multas, CNH suspensa/cassada)</option>
                          <option value="Administrativo Documentos">Serviços Administrativos Gerais</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1"> Relato breve do seu caso (opcional) </label>
                      <textarea
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        rows={4}
                        placeholder="Escreva brevemente o ocorrido para agilizarmos sua triagem..."
                        className="w-full bg-gray-50 border border-gray-250 rounded-lg px-4 py-3 text-xs text-gray-800 placeholder-gray-450 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white resize-none"
                      />
                    </div>

                    {/* Honeypot field - visually hidden */}
                    <div className="hidden" aria-hidden="true">
                      <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1">Website</label>
                      <input
                        type="text"
                        tabIndex={-1}
                        value={contactWebsite}
                        onChange={(e) => setContactWebsite(e.target.value)}
                        placeholder="Deixe em branco se for humano"
                        autoComplete="off"
                      />
                    </div>

                    <div className="flex items-start gap-2.5">
                      <input 
                        type="checkbox" 
                        required 
                        id="agree-lgpd"
                        defaultChecked
                        className="mt-1 accent-brand-gold-600" 
                      />
                      <label htmlFor="agree-lgpd" className="text-[10px] text-gray-500 leading-normal">
                        Declaro que li e estou de acordo com a <button type="button" onClick={() => openLegal("privacy")} className="text-brand-gold-600 hover:underline">Política de Privacidade</button> de dados conforme as diretrizes da LGPD brasileira. *
                      </label>
                    </div>

                    <button
                      type="submit"
                      id="submit-contact-form-btn"
                      className="w-full py-3.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <span>Solicitar Pré-Análise via WhatsApp</span>
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-navy-950 border-t border-brand-gold-500/20 pt-16 pb-32 sm:pb-24 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          {/* Top row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Logo and brief intro */}
            <div className="md:col-span-4 space-y-4">
              <div className="flex flex-row items-center gap-3.5">
                <div className="flex items-center justify-center shrink-0">
                  <Logo logoUrl={siteConfigData.logoUrl} iconClassName="w-13 h-13 shadow-md" />
                </div>
                <div className="flex flex-col text-left justify-center gap-1 py-0.5">
                  <h4 className="text-white font-serif font-bold text-lg leading-none">SP Assessoria</h4>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-brand-gold-500 font-sans font-semibold leading-none">Recursos Administrativos</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                Compromisso com o cidadão, desmistificando trâmites perante o INSS, DETRAN e demais órgãos públicos de forma 100% digital e transparente.
              </p>
            </div>

            {/* Quick Links Column */}
            <div className="md:col-span-2 space-y-3">
              <h5 className="text-xs uppercase tracking-wider font-semibold text-brand-gold-500 font-mono">Navegação</h5>
              <div className="flex flex-col gap-2 text-xs text-gray-400">
                <a href="#quem-somos" className="hover:text-white transition-colors">Quem Somos</a>
                <a href="#servicos" className="hover:text-white transition-colors">Áreas de Atuação</a>
                <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
                <a href="#portal-cliente" className="hover:text-white transition-colors">Área do Cliente</a>
                <a href="#blog" className="hover:text-white transition-colors">Blog & Informativos</a>
              </div>
            </div>

            {/* Legal Links Column */}
            <div className="md:col-span-2 space-y-3">
              <h5 className="text-xs uppercase tracking-wider font-semibold text-brand-gold-500 font-mono">Institucional</h5>
              <div className="flex flex-col gap-2 text-xs text-gray-400">
                <button onClick={() => openLegal("privacy")} className="text-left hover:text-white transition-colors cursor-pointer">Política de Privacidade</button>
                <button onClick={() => openLegal("terms")} className="text-left hover:text-white transition-colors cursor-pointer">Termos de Uso</button>
                <a href="#perguntas-frequentes" className="hover:text-white transition-colors">Dúvidas Frequentes</a>
                <a href="#contato" className="hover:text-white transition-colors">Fale Conosco</a>
              </div>
            </div>

            {/* Important Disclaimer Warning */}
            <div className="md:col-span-4 space-y-3">
              <h5 className="text-xs uppercase tracking-wider font-semibold text-amber-500 font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>AVISO LEGAL OBRIGATÓRIO (LGPD/OAB)</span>
              </h5>
              <p className="text-[10px] text-gray-400 leading-normal bg-[#0a1424] p-4 rounded-xl border border-white/10 italic">
                A SP Assessoria de Recursos Administrativos é uma empresa constituída para prestar consultoria e assessoria <strong>EXCLUSIVAMENTE extrajudicial e de caráter administrativo</strong>. Não realizamos representação em juízo (esfera judicial) e nem prestamos serviços privativos da advocacia, ressalvado quando expressamente acompanhado por advogado legalmente habilitado responsável.
              </p>
            </div>

          </div>

          {/* Divider and CNPJ copyright info */}
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-gray-500">
            <div className="text-center sm:text-left space-y-1">
              <p>© 2026 SP Assessoria de Recursos Administrativos. Todos os direitos reservados.</p>
              <p>CNPJ sob nº 67.851.115/0001-60 | São Paulo - SP</p>
            </div>
            
            <div className="flex gap-4 items-center sm:pr-24">
              <button 
                onClick={() => openLegal("privacy")}
                className="hover:text-brand-gold-500 hover:underline cursor-pointer"
              >
                LGPD
              </button>
              <span>|</span>
              <button 
                onClick={() => openLegal("terms")}
                className="hover:text-brand-gold-500 hover:underline cursor-pointer"
              >
                Termos
              </button>
              <span>|</span>
              <button 
                onClick={() => setAdminOpen(true)}
                className="hover:text-brand-gold-500 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
              >
                <Lock className="w-2.5 h-2.5" />
                <span>Painel Admin</span>
              </button>
            </div>
          </div>

        </div>
      </footer>

      {/* FLOATING ACTION OVERLAYS */}
      <WhatsAppButton onOpenModal={() => setWhatsAppModalOpen(true)} />

      {/* MODALS */}
      <WhatsAppLeadModal 
        isOpen={whatsAppModalOpen} 
        onClose={() => setWhatsAppModalOpen(false)} 
      />
      <BudgetModal 
        isOpen={budgetModalOpen} 
        onClose={() => setBudgetModalOpen(false)} 
        onLeadAdded={(newLead) => {
          const updatedLeads = [newLead, ...(siteData.leads || [])];
          const updatedData = { ...siteData, leads: updatedLeads };
          setSiteData(updatedData);
          localStorage.setItem("sp_site_data", JSON.stringify(updatedData));
        }}
      />

      <LegalModal 
        isOpen={legalModalOpen} 
        onClose={() => setLegalModalOpen(false)} 
        type={legalModalType} 
      />

      {/* BlogPost Reader Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div 
            id="blog-modal-container"
            className="relative w-full max-w-2xl bg-white border border-gray-150 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <span className="px-2.5 py-1 bg-brand-gold-500/10 border border-brand-gold-500/20 text-brand-gold-700 font-mono text-[9px] uppercase font-bold rounded">
                {selectedPost.category}
              </span>
              <button 
                id="close-blog-modal-btn"
                onClick={() => setSelectedPost(null)} 
                className="p-1.5 text-gray-400 hover:text-brand-navy-900 transition-colors rounded-lg hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable post content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <img 
                src={selectedPost.imageUrl} 
                alt={selectedPost.title} 
                className="w-full h-56 object-cover rounded-lg border border-gray-100 shadow-xs"
              />
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Calendar className="w-4 h-4 text-brand-gold-600" />
                <span>{selectedPost.date}</span>
                <span>•</span>
                <span>{selectedPost.readTime}</span>
              </div>
              
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-brand-navy-900 text-left">
                {selectedPost.title}
              </h2>

              <p className="text-sm font-semibold text-brand-gold-700 leading-relaxed text-left">
                {selectedPost.summary}
              </p>

              <div className="text-xs sm:text-sm text-gray-600 leading-relaxed text-left space-y-4 whitespace-pre-wrap font-sans border-t border-gray-100 pt-4">
                {selectedPost.content}
              </div>
            </div>

            {/* Footer action */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs">
              <span className="text-gray-500">Gostaria de falar sobre este assunto?</span>
              <button
                id="blog-discuss-btn"
                onClick={() => {
                  const title = selectedPost.title;
                  setSelectedPost(null);
                  const phone = "5511987049051";
                  const text = `Olá! Estava lendo o artigo "${title}" no blog de vocês e gostaria de tirar uma dúvida sobre o meu caso.`;
                  window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Falar com Consultor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Dashboard modal overlay */}
      <AdminDashboard 
        isOpen={adminOpen} 
        onClose={() => setAdminOpen(false)} 
        siteData={siteData} 
        onDataUpdate={saveSiteData} 
      />

    </div>
  );
}
