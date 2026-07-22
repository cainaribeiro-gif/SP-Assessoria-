import { GoogleGenAI } from "@google/genai";

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export async function handler(event: any): Promise<HandlerResponse> {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "GEMINI_API_KEY não configurada no servidor." })
      };
    }

    const payload = JSON.parse(event.body || "{}");
    const { prompt, context } = payload;

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "O campo 'prompt' é obrigatório." })
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `Você é o assistente virtual com Inteligência Artificial especializado da SP Assessoria de Recursos Administrativos.
Sua especialidade é orientar sobre recursos de multas de trânsito, suspensão/cassação de CNH, benefícios do INSS (BPC/LOAS, auxílio-doença, aposentadorias) e processos administrativos.
Responda de forma cortês, profissional, precisa e acolhedora em Português do Brasil.
Aponte que o e-mail oficial para contato é atendimento.spassessoria@gmail.com.
Nunca invente termos jurídicos irreais ou prometa vitórias garantidas.`;

    const fullPrompt = context ? `[Contexto da Consulta: ${context}]\n\nSolicitação do Cliente: ${prompt}` : prompt;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        systemInstruction
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: response.text })
    };
  } catch (err: any) {
    console.error("Erro na função Gemini Netlify:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Erro ao processar consulta de IA." })
    };
  }
}
