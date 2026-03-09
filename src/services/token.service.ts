import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { UserTokens, TokenSet } from '../models';
import { encrypt, decrypt } from '../utils';

export class TokenService {
  private collectionRef;

  constructor(
    private db: Firestore,
    private encryptionKey: string
  ) {
    this.collectionRef = db.collection('tokens');
  }

  async getTokens(slackUserId: string): Promise<UserTokens | null> {
    const doc = await this.collectionRef.doc(slackUserId).get();
    if (!doc.exists) return null;
    return this.decryptTokenDoc(doc.data()!, slackUserId);
  }

  async saveSlackTokens(slackUserId: string, tokenSet: TokenSet): Promise<void> {
    await this.collectionRef.doc(slackUserId).set(
      { slack: this.encryptTokenSet(tokenSet), updatedAt: Timestamp.now() },
      { merge: true }
    );
  }

  async saveJiraTokens(slackUserId: string, tokenSet: TokenSet & { cloudId: string; siteUrl: string }): Promise<void> {
    const { cloudId, siteUrl, ...rest } = tokenSet;
    await this.collectionRef.doc(slackUserId).set(
      { jira: { ...this.encryptTokenSet(rest), cloudId, siteUrl }, updatedAt: Timestamp.now() },
      { merge: true }
    );
  }

  async saveGoogleTokens(slackUserId: string, tokenSet: TokenSet): Promise<void> {
    await this.collectionRef.doc(slackUserId).set(
      { google: this.encryptTokenSet(tokenSet), updatedAt: Timestamp.now() },
      { merge: true }
    );
  }

  async deleteTokens(slackUserId: string): Promise<void> {
    await this.collectionRef.doc(slackUserId).delete();
  }

  private encryptTokenSet(tokenSet: TokenSet): Record<string, unknown> {
    return {
      accessToken: encrypt(tokenSet.accessToken, this.encryptionKey),
      refreshToken: encrypt(tokenSet.refreshToken, this.encryptionKey),
      expiresAt: Timestamp.fromDate(tokenSet.expiresAt),
      ...(tokenSet.scope ? { scope: tokenSet.scope } : {}),
    };
  }

  private decryptTokenSet(data: Record<string, unknown>): TokenSet {
    return {
      accessToken: decrypt(data.accessToken as string, this.encryptionKey),
      refreshToken: decrypt(data.refreshToken as string, this.encryptionKey),
      expiresAt: (data.expiresAt as Timestamp).toDate(),
      ...(data.scope ? { scope: data.scope as string } : {}),
    };
  }

  private decryptTokenDoc(data: Record<string, unknown>, slackUserId: string): UserTokens {
    const result: UserTokens = {
      slackUserId,
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    };

    if (data.slack) {
      result.slack = this.decryptTokenSet(data.slack as Record<string, unknown>);
    }
    if (data.jira) {
      const jiraData = data.jira as Record<string, unknown>;
      result.jira = {
        ...this.decryptTokenSet(jiraData),
        cloudId: jiraData.cloudId as string,
        siteUrl: jiraData.siteUrl as string,
      };
    }
    if (data.google) {
      result.google = this.decryptTokenSet(data.google as Record<string, unknown>);
    }

    return result;
  }
}
