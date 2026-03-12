import { WebClient, type ChatPostMessageResponse } from '@slack/web-api';
import { config } from '../config';
import { KnownBlock } from '@slack/web-api';

export class SlackService {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async postMessage(
    channel: string,
    blocks: KnownBlock[],
    text: string
  ): Promise<ChatPostMessageResponse> {
    return this.client.chat.postMessage({ channel, blocks, text });
  }

  async postEphemeral(
    channel: string,
    user: string,
    blocks: KnownBlock[],
    text: string
  ): Promise<void> {
    await this.client.chat.postEphemeral({ channel, user, blocks, text });
  }

  async openModal(triggerId: string, view: Record<string, unknown>): Promise<void> {
    await this.client.views.open({ trigger_id: triggerId, view: view as never });
  }

  async updateMessage(
    channel: string,
    ts: string,
    blocks: KnownBlock[],
    text: string,
  ): Promise<void> {
    await this.client.chat.update({ channel, ts, blocks, text });
  }
}

export function getSlackService(): SlackService {
  const token = config.slack.botToken;
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN not configured');
  }
  return new SlackService(token);
}
