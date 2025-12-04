import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { EXPERT_SYSTEM_PROMPT } from '../constants';

const getClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key not found. Please set API_KEY in your environment variables.");
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
      const parts: any[] = [{ text: msg.text }];
      
      if (msg.image) {
        // Extract base64 data and mimeType
        // Assuming standard format: "data:image/jpeg;base64,..."
        const match = msg.image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (match) {
           // Insert image BEFORE text for better context understanding in most cases, 
           // though Gemini handles both orderings.
           parts.unshift({
             inlineData: {
               mimeType: match[1],
               data: match[2]
             }
           });
        }
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
        tools: [{ googleSearch: {} }] 
      },
      history: optimizedHistory,
    });

    // Prepare current message parts
    const currentParts: any[] = [{ text: userMessage }];
    if (image) {
        const match = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (match) {
            currentParts.unshift({
                inlineData: {
                    mimeType: match[1],
                    data: match[2]
                }
            });
        }
    }

    // Since chat.sendMessage takes a string or parts, and we might have image + text,
    // we use the generic payload structure.
    const response: GenerateContentResponse = await chat.sendMessage({
      message: currentParts.length === 1 && currentParts[0].text ? currentParts[0].text : currentParts,
    });

    let responseText = response.text;
    if (!responseText) {
        throw new Error("Пустой ответ от модели.");
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