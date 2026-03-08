import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { Team } from '../models';

const teamConverter: FirebaseFirestore.FirestoreDataConverter<Team> = {
  toFirestore(team: Team): FirebaseFirestore.DocumentData {
    return {
      ...team,
      installedAt: Timestamp.fromDate(team.installedAt),
    };
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Team {
    const data = snapshot.data();
    return {
      ...data,
      installedAt: (data.installedAt as Timestamp).toDate(),
    } as Team;
  },
};

export class TeamService {
  private collection;

  constructor(private db: Firestore) {
    this.collection = db.collection('teams').withConverter(teamConverter);
  }

  async getBySlackTeamId(slackTeamId: string): Promise<Team | null> {
    const doc = await this.collection.doc(slackTeamId).get();
    return doc.exists ? doc.data()! : null;
  }

  async create(team: Team): Promise<void> {
    await this.collection.doc(team.slackTeamId).set(team);
  }

  async update(slackTeamId: string, updates: Partial<Team>): Promise<void> {
    await this.db.collection('teams').doc(slackTeamId).update(updates);
  }

  async delete(slackTeamId: string): Promise<void> {
    await this.collection.doc(slackTeamId).delete();
  }
}
