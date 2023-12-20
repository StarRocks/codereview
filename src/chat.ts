import { GoogleGenerativeAI } from '@google/generative-ai'

export class Chat {
  private genAI: GoogleGenerativeAI;
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
  }

  public generatePrompt = (patch: string) => {
    const prompt = process.env.PROMPT || 'please review the following code';
    return `${prompt}:
    ${patch}
    `;
  };

  public codeReview = async (prompt: string) => {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response;
  };
}
