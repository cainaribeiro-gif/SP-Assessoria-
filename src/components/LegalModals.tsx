import React from "react";
import { X, Shield, FileText } from "lucide-react";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "privacy" | "terms";
}

export function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        id="legal-modal-container"
        className="relative w-full max-w-3xl bg-white border border-gray-150 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {type === "privacy" ? (
              <Shield className="w-6 h-6 text-brand-gold-600" />
            ) : (
              <FileText className="w-6 h-6 text-brand-gold-600" />
            )}
            <h2 className="text-xl font-display font-extrabold text-brand-navy-900 text-left">
              {type === "privacy" ? "Política de Privacidade (LGPD)" : "Termos de Uso"}
            </h2>
          </div>
          <button 
            id="close-legal-modal-btn"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-brand-navy-900 transition-colors rounded-lg hover:bg-gray-200 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-gray-600 space-y-4 text-xs sm:text-sm leading-relaxed text-left">
          {type === "privacy" ? (
            <>
              <p className="font-bold text-brand-navy-900">Última atualização: Julho de 2026</p>
              <p>
                A <strong>SP Assessoria de Recursos Administrativos</strong>, inscrita no CNPJ sob o nº 67.851.115/0001-60, valoriza a privacidade e a segurança das informações de seus clientes. Esta política descreve como coletamos, usamos e protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">1. Dados que Coletamos</h3>
              <p>
                Para prestar nossos serviços de assessoria extrajudicial, coletamos dados fornecidos diretamente por você, tais como: nome completo, CPF, RG, CNH, comprovante de residência, histórico de infrações de trânsito, extratos do INSS (CNIS) e documentos médicos ou previdenciários pertinentes.
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">2. Finalidade do Tratamento</h3>
              <p>
                Os dados coletados destinam-se exclusivamente a:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Análise técnica de viabilidade de defesas e recursos administrativos;</li>
                <li>Elaboração de requerimentos, defesas prévias e recursos perante o INSS, JARI, CETRAN, e demais órgãos públicos;</li>
                <li>Comunicação e acompanhamento das etapas do processo administrativo;</li>
                <li>Cumprimento de obrigações fiscais e de faturamento.</li>
              </ul>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">3. Compartilhamento de Dados</h3>
              <p>
                Os dados pessoais não são vendidos ou compartilhados com terceiros para fins de marketing. O compartilhamento ocorre de forma restrita com os respectivos órgãos públicos federais, estaduais ou municipais responsáveis pelo andamento do seu processo (como INSS, DETRAN, DER, PRF, etc.), unicamente para cumprimento da finalidade do serviço contratado.
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">4. Segurança dos Seus Dados</h3>
              <p>
                Adotamos medidas técnicas e administrativas rigorosas para proteger seus dados contra acessos não autorizados, perda, destruição, alteração ou vazamento, mantendo as informações armazenadas em servidores protegidos.
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">5. Seus Direitos</h3>
              <p>
                Como titular dos dados, você pode, a qualquer momento, solicitar o acesso, retificação, exclusão (salvo se houver obrigação legal de guarda), portabilidade ou limitação do tratamento de seus dados por meio do e-mail: <strong>atendimento.spassessoria@gmail.com</strong>.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-brand-navy-900">Última atualização: Julho de 2026</p>
              <p>
                Ao acessar e utilizar os serviços da <strong>SP Assessoria de Recursos Administrativos</strong>, você concorda com as condições descritas nestes Termos de Uso.
              </p>

              <h3 className="text-base font-bold text-red-700 mt-4">⚠️ AVISO LEGAL CRÍTICO - ESCOPO DE ATUAÇÃO</h3>
              <div className="p-4 bg-gray-50 border-l-4 border-brand-gold-600 text-xs sm:text-sm italic rounded-r-lg border border-gray-200">
                <strong>Importante:</strong> A SP Assessoria de Recursos Administrativos é uma empresa prestadora de serviços de consultoria e representação <strong>exclusivamente na esfera administrativa (extrajudicial)</strong>. Nós <strong>NÃO</strong> exercemos atividades privativas da advocacia (nos termos do Estatuto da Advocacia e da OAB - Lei nº 8.906/94). Nossos serviços compreendem a análise de documentos, elaboração de requerimentos e elaboração de recursos encaminhados diretamente a órgãos públicos (como INSS e órgãos de trânsito). Caso seu caso demande representação judicial ou peticionamento em juízo, orientamos que busque um advogado legalmente habilitado ou a Defensoria Pública.
              </div>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">1. Responsabilidades do Usuário</h3>
              <p>
                O cliente é inteiramente responsável pela veracidade, autenticidade e tempestividade dos documentos e informações fornecidos para a elaboração dos recursos administrativos. Documentos ilegíveis, falsos ou entregues fora do prazo legal estipulado pelo órgão público isentam a SP Assessoria de qualquer responsabilidade por eventuais indeferimentos.
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">2. Limitação de Resultados</h3>
              <p>
                A atuação da SP Assessoria consiste em obrigação de meio, aplicando toda a diligence técnica e fundamentação legal cabível para obter o êxito do recurso. Contudo, a decisão de deferimento ou indeferimento cabe de forma exclusiva e soberana aos julgadores dos respectivos órgãos públicos responsáveis (INSS, JARI, CETRAN, etc.). Portanto, não garantimos resultados favoráveis prévios.
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">3. Honorários e Pagamento</h3>
              <p>
                Os honorários relativos à assessoria administrativa serão formalizados por meio de orçamento prévio e contrato de prestação de serviços específico para cada caso. Os prazos de elaboração se iniciam apenas após a compensação do pagamento acordado e envio integral da documentação exigida.
              </p>

              <h3 className="text-base font-bold text-brand-gold-700 mt-4">4. Foro de Eleição</h3>
              <p>
                Para dirimir quaisquer controvérsias decorrentes destes termos ou da prestação dos serviços administrativos, as partes elegem o foro da Comarca de São Paulo/SP, com renúncia expressa a qualquer outro.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            id="accept-legal-btn"
            onClick={onClose}
            className="px-6 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold rounded-lg transition-all shadow-xs cursor-pointer text-xs sm:text-sm"
          >
            Entendido e De Acordo
          </button>
        </div>
      </div>
    </div>
  );
}
