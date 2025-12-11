import { GoogleGenAI, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { EXPERT_SYSTEM_PROMPT } from '../constants';

const getClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("API Key is missing in environment variables.");
    throw new Error("API Key not found. Please set API_KEY in your .env file or environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// Best Practice: Token Management
const MAX_HISTORY_LENGTH = 30;

const pruneHistory = (history: { role: string; parts: { text?: string; inlineData?: any }[] }[]) => {
  if (history.length <= MAX_HISTORY_LENGTH) return history;
  return history.slice(-MAX_HISTORY_LENGTH);
};

export const sendMessageToGemini = async (
  userMessage: string,
  image: string | null, // Base64 string or null
  history: { role: string; text: string; image?: string }[] = []
): Promise<string> => {
  try {
    const ai = getClient();
    
    // Using gemini-2.5-flash which supports multimodal input
    const model = 'gemini-2.5-flash';

    // Convert internal message format to API format
    // We need to properly format history to include images if they existed in previous turns
    const formattedHistory = history.map(msg => {
      const parts: any[] = [];
      
      if (msg.image) {
        // Extract base64 data and mimeType
        // Assuming standard format: "data:image/jpeg;base64,..."
        const match = msg.image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (match) {
           parts.push({
             inlineData: {
               mimeType: match[1],
               data: match[2]
             }
           });
        }
      }

      // Only add text part if it's not empty, OR if it's the only part (to avoid empty content error)
      if (msg.text && msg.text.trim() !== "") {
        parts.push({ text: msg.text });
      } else if (parts.length === 0) {
        // If we have no image and empty text, we must provide something, though this shouldn't happen in valid history
        parts.push({ text: " " }); 
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      };
    });

    // Optimize Context
    const optimizedHistory = pruneHistory(formattedHistory);

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: EXPERT_SYSTEM_PROMPT,
        temperature: 0.7,
        // Enable Google Search Grounding to handle URLs in user prompt
        tools: [{ googleSearch: {} }],
        // Relax safety settings for Red Team/Analysis use cases
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ]
      },
      history: optimizedHistory,
    });

    // Prepare current message parts
    const currentParts: any[] = [];
    
    if (image) {
        const match = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (match) {
            currentParts.push({
                inlineData: {
                    mimeType: match[1],
                    data: match[2]
                }
            });
        }
    }

    if (userMessage && userMessage.trim() !== "") {
        currentParts.push({ text: userMessage });
    } else if (currentParts.length === 0) {
        throw new Error("Сообщение не может быть пустым.");
    }

    // Since chat.sendMessage takes a string or parts, and we might have image + text,
    // we use the generic payload structure.
    const response: GenerateContentResponse = await chat.sendMessage({
      message: currentParts.length === 1 && currentParts[0].text ? currentParts[0].text : currentParts,
    });

    // Check candidates for safety finish reasons
    if (response.candidates && response.candidates[0]) {
        const candidate = response.candidates[0];
        if (candidate.finishReason === 'SAFETY') {
             throw new Error("Ответ модели заблокирован настройками безопасности. Попробуйте переформулировать запрос.");
        }
        if (candidate.finishReason === 'RECITATION') {
             throw new Error("Ответ заблокирован из-за повторения защищенного контента (Recitation).");
        }
        if (candidate.finishReason === 'OTHER') {
             console.warn("Model finished with reason OTHER", candidate);
        }
    }

    let responseText = response.text;
    
    // Fallback: If no text but we have candidates, try to see if there's anything else useful or a specific error state
    if (!responseText && response.candidates && response.candidates.length > 0) {
        // Sometimes text might be in parts but .text getter fails? Unlikely with SDK, but possible if mixed content.
        const parts = response.candidates[0].content?.parts;
        if (parts && parts.length > 0) {
            responseText = parts.map((p: any) => p.text || '').join('');
        }
    }

    if (!responseText) {
        console.error("Empty response received. Full response object:", JSON.stringify(response, null, 2));
        throw new Error("Пустой ответ от модели. Возможно, запрос слишком сложный или нарушает политики.");
    }

    // Extract and append grounding sources if available, as per guidelines
    const candidates = response.candidates;
    if (candidates && candidates[0] && candidates[0].groundingMetadata?.groundingChunks) {
        const chunks = candidates[0].groundingMetadata.groundingChunks;
        const sources = chunks.map((chunk: any, index: number) => {
            if (chunk.web) {
                return `[${index + 1}] [${chunk.web.title}](${chunk.web.uri})`;
            }
            return null;
        }).filter((s: string | null) => s !== null);

        if (sources.length > 0) {
            responseText += "\n\n---\n**Источники:**\n" + sources.join("\n");
        }
    }

    return responseText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Safe error parsing for different environments
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes('429')) {
        return "Слишком много запросов. Пожалуйста, подождите немного.";
    }
    return `Ошибка: ${errorMessage}`;
  }
};