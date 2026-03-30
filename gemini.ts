import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseSudokuImage(base64Image: string) {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
          {
            text: "Extract the Sudoku board from this image. Return a 9x9 grid where 0 represents an empty cell. Provide the result as a JSON array of arrays.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grid: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
            description: "A 9x9 grid representing the Sudoku board.",
          },
        },
        required: ["grid"],
      },
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return data.grid as number[][];
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Could not parse Sudoku from image.");
  }
}
