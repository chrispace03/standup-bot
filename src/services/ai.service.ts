import Anthropic from '@anthropic-ai/sdk';

export interface BlockerEntry {
  date: string;
  text: string;
}

export class AIService {
  private client: Anthropic | null = null;

  constructor(private apiKey?: string) {
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async summarizeBlockers(blockers: BlockerEntry[]): Promise<string | null> {
    if (!this.client || blockers.length === 0) return null;

    const blockerList = blockers
      .map((b) => `- ${b.date}: ${b.text}`)
      .join('\n');

    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are an engineering manager's assistant. Analyze these blockers from a developer's weekly standups and provide a brief summary (2-3 sentences). Identify patterns, recurring themes, or escalation needs. Be concise and actionable.

Blockers this week:
${blockerList}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text : null;
  }
}
