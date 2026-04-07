// Kie.ai Gemini 2.5 Flash - OpenAI compatible API
const KIE_API_URL = 'https://api.kie.ai/gemini-2.5-flash/v1/chat/completions';

export const generateScenePrompt = async (
  startFrameBase64: string,
  endFrameBase64: string,
  userTemplate: string,
  apiKeyOverride?: string,
  systemInstruction?: string
): Promise<string> => {
  // Only use user-provided API key - no built-in key for security
  const apiKey = apiKeyOverride || '';
  
  if (!apiKey) throw new Error("NO_API_KEY");

  try {
    // Clean base64 strings and build data URLs
    const cleanStart = startFrameBase64.includes(',') 
      ? startFrameBase64 
      : `data:image/jpeg;base64,${startFrameBase64}`;
    const cleanEnd = endFrameBase64.includes(',') 
      ? endFrameBase64 
      : `data:image/jpeg;base64,${endFrameBase64}`;

    const response = await fetch(KIE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: systemInstruction || "You are an expert creative director for AI video generation. Your goal is to write prompts that perfectly describe the visual flow between two keyframes."
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Here is the START frame of the video scene:' },
              {
                type: 'image_url',
                image_url: { url: cleanStart }
              },
              { type: 'text', text: 'Here is the END frame of the video scene:' },
              {
                type: 'image_url',
                image_url: { url: cleanEnd }
              },
              {
                type: 'text',
                text: `Task: Generate a highly accurate video generation prompt based on these two frames using the template below.
             
1. Analyze the START frame to describe the initial subject, environment, and lighting condition.
2. Analyze the END frame to understand how the scene has progressed (camera movement, subject action, lighting shift).
3. Fill in the template to describe this specific progression from start to finish.

Template: "${userTemplate}"

Instructions:
- The [action] must describe the movement bridging the two frames.
- The [subject] must match the visual evidence in the frames.
- Output ONLY the completed prompt text.`
              }
            ]
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      
      if (response.status === 401 || response.status === 403) {
        return "Error: Invalid API Key. Please check your Kie.ai API key in settings.";
      }
      if (response.status === 429) {
        return "Error: Quota exceeded. Please try again later or check your Kie.ai account balance.";
      }

      console.error("API Error:", response.status, errorBody);
      return `Error: API returned ${response.status}. ${errorBody}`;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    return content?.trim() || "Failed to generate prompt.";
  } catch (error: any) {
    console.error("Kie API Error:", error);

    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return "Error communicating with Kie API.";
  }
};

// Keeping this for backward compatibility if needed
export const generateImagePrompt = async (
  imageBase64: string,
  userTemplate: string
): Promise<string> => {
  return "";
};