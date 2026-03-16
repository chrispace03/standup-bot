import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { StandupRecord, CalendarEventReference } from '../models';

const standupConverter: FirebaseFirestore.FirestoreDataConverter<StandupRecord> = {
  toFirestore(record: StandupRecord): FirebaseFirestore.DocumentData {
    return {
      ...record,
      postedAt: record.postedAt ? Timestamp.fromDate(record.postedAt) : null,
      events: record.events.map((e) => ({
        ...e,
        startTime: Timestamp.fromDate(e.startTime),
        endTime: Timestamp.fromDate(e.endTime),
      })),
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): StandupRecord {
    const data = snapshot.data();
    return {
      ...data,
      postedAt: data.postedAt ? (data.postedAt as Timestamp).toDate() : undefined,
      events: (data.events || []).map((e: Record<string, unknown>) => ({
        ...e,
        startTime: (e.startTime as Timestamp).toDate(),
        endTime: (e.endTime as Timestamp).toDate(),
      } as CalendarEventReference)),
    } as StandupRecord;
  },
};

export class StandupService {
  private collection;

  constructor(private db: Firestore) {
    this.collection = db.collection('standups').withConverter(standupConverter);
  }

  async getById(date: string, userId: string): Promise<StandupRecord | null> {
    const doc = await this.collection.doc(`${date}_${userId}`).get();
    return doc.exists ? doc.data()! : null;
  }

  async save(record: StandupRecord): Promise<void> {
    const docId = `${record.date}_${record.userId}`;
    await this.collection.doc(docId).set(record);
  }

  async getHistory(userId: string, limit: number = 14): Promise<StandupRecord[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getByDate(date: string): Promise<StandupRecord[]> {
    const snapshot = await this.collection
      .where('date', '==', date)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<StandupRecord[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getRecent(limit: number = 50): Promise<StandupRecord[]> {
    const snapshot = await this.collection
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async delete(date: string, userId: string): Promise<void> {
    await this.collection.doc(`${date}_${userId}`).delete();
  }
}
