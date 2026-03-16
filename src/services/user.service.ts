import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { User } from '../models';

const userConverter: FirebaseFirestore.FirestoreDataConverter<User> = {
  toFirestore(user: User): FirebaseFirestore.DocumentData {
    return {
      ...user,
      createdAt: Timestamp.fromDate(user.createdAt),
      updatedAt: Timestamp.fromDate(user.updatedAt),
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): User {
    const data = snapshot.data();
    return {
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    } as User;
  },
};

export class UserService {
  private collection;

  constructor(private db: Firestore) {
    this.collection = db.collection('users').withConverter(userConverter);
  }

  async getBySlackId(slackUserId: string): Promise<User | null> {
    const doc = await this.collection.doc(slackUserId).get();
    return doc.exists ? doc.data()! : null;
  }

  async create(user: User): Promise<void> {
    await this.collection.doc(user.slackUserId).set(user);
  }

  async update(slackUserId: string, updates: Partial<User>): Promise<void> {
    await this.db.collection('users').doc(slackUserId).update({
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async getByTeam(slackTeamId: string): Promise<User[]> {
    const snapshot = await this.collection
      .where('slackTeamId', '==', slackTeamId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getEnabledUsers(): Promise<User[]> {
    const snapshot = await this.collection
      .where('standupEnabled', '==', true)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getAll(): Promise<User[]> {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async delete(slackUserId: string): Promise<void> {
    await this.collection.doc(slackUserId).delete();
  }
}
