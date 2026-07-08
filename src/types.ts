export interface ServiceItem {
  title: string;
  items: string[];
  description: string;
}

export interface BlogPost {
  id: string;
  title: string;
  category: "INSS" | "Trânsito" | "Administrativo" | "Direitos";
  date: string;
  readTime: string;
  summary: string;
  content: string;
  imageUrl: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface Review {
  id: string;
  author: string;
  stars: number;
  date: string;
  text: string;
  serviceType: string;
}

export interface TimelineStep {
  title: string;
  status: "completed" | "current" | "pending";
  date?: string;
  description: string;
}

export interface ProcessStatus {
  protocol: string;
  clientName: string;
  service: string;
  currentStep: string;
  lastUpdate: string;
  timeline: TimelineStep[];
}
