import { ChatGPTAPI } from 'chatgpt';

export class Chat {
  private chatAPI: ChatGPTAPI;
  constructor() {
    this.chatAPI = new ChatGPTAPI({
      apiKey: process.env.OPENAI_API_KEY || '',
      apiBaseUrl:'https://api.openai.com/v1',
      completionParams: {
        model: process.env.MODEL || 'gpt-3.5-turbo',
        temperature: 1,
        top_p: 1,
      },
    });
  }

  public generatePrompt = (patch: string) => {
    const prompt = process.env.PROMPT || 'please review the following code';
    return `${prompt}:
    ${patch}
    `;
  };

  public codeReview = async (prompt: string) => {
    return await this.chatAPI.sendMessage(prompt);
  };
}
