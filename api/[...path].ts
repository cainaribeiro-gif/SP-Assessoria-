let appPromise: Promise<any> | undefined;

export default async function handler(req: any, res: any) {
  process.env.VERCEL = "1";

  try {
    appPromise ??= import("../server.js").then((module) => module.default || module.app);

    const app = await appPromise;

    return app(req, res);
  } catch (error) {
    console.error("Falha ao inicializar a API na Vercel:", error);

    return res.status(500).json({
      success: false,
      error: "Erro interno ao processar a solicitação.",
      code: "API_INITIALIZATION_ERROR"
    });
  }
}
