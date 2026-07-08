import React, { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";

export function WhatsAppButton() {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Show a small tooltip/notification after 4 seconds
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    // Standard contact links provided: (11) 98704-9051 / (11) 99334-4293
    const phone = "5511987049051"; // Default to primary
    const text = "Olá! Gostaria de falar com um especialista da SP Assessoria de Recursos Administrativos sobre o meu caso.";
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`, "_blank");
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {showTooltip && (
        <div 
          id="whatsapp-tooltip"
          className="bg-white text-gray-800 text-xs py-2 px-3.5 border border-gray-150 rounded-xl shadow-xl animate-bounce flex items-center gap-2 max-w-[220px]"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-gray-700">
            Fale conosco on-line! <strong>WhatsApp</strong>
          </span>
          <button 
            id="close-whatsapp-tooltip"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }} 
            className="text-gray-400 hover:text-brand-navy-900 ml-1 font-extrabold font-sans text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
      
      <button
        id="floating-whatsapp-btn"
        onClick={handleClick}
        className="relative p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 group focus:outline-hidden cursor-pointer"
        aria-label="Falar no WhatsApp"
      >
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full bg-emerald-600/30 animate-ping group-hover:animate-none -z-10" />
        
        {/* Lucide icon */}
        <MessageSquare className="w-7 h-7 fill-white" />
        
        {/* Red notification dot */}
        <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
          1
        </span>
      </button>
    </div>
  );
}
