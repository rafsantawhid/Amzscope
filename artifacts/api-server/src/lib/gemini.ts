import { ProviderSetupError } from "./amazon";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export async function askGemini(
  message: string,
  context?: string | null,
  asin?: string | null,
) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ProviderSetupError();
  }

  const system = [
    "You are AmazonScope Assistant, an expert Amazon marketplace analyst.",
    "Only answer Amazon-related questions: ASIN analysis, product research, reviews, BSR, sellers, listings, FBA, FBM, keywords, ranking, and product optimization.",
    "If the question is outside Amazon commerce, politely refuse in one sentence and invite an Amazon-related question.",
    "Be concise, practical, and explicit about uncertainty. Never invent live metrics.",
  ].join(" ");
  const prompt = [system, asin ? `ASIN in focus: ${asin}` : "", context ? `Product context: ${context}` : "", `User question: ${message}`]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }
  const data = (await response.json()) as GeminiResponse;
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!content) throw new Error("Gemini returned an empty response");
  return content;
}