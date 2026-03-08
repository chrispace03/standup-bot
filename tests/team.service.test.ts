import { TeamService } from '../src/services/team.service';
import { createMockFirestore } from './helpers/mock-firestore';
import { Team } from '../src/models';

const mockTeam: Team = {
  slackTeamId: 'T12345',
  teamName: 'Test Team',
  installedBy: 'U12345',
  installedAt: new Date('2026-01-01'),
  settings: {
    standupDays: [1, 2, 3, 4, 5],
    reminderEnabled: true,
  },
};

describe('TeamService', () => {
  let service: TeamService;
  let mocks: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    mocks = createMockFirestore();
    service = new TeamService(mocks.db);
  });

  describe('getBySlackTeamId', () => {
    it('returns team when document exists', async () => {
      mocks.mockDocSnapshot.exists = true;
      mocks.mockDocSnapshot.data.mockReturnValue(mockTeam);

      const result = await service.getBySlackTeamId('T12345');
      expect(result).toEqual(mockTeam);
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('T12345');
    });

    it('returns null when not found', async () => {
      mocks.mockDocSnapshot.exists = false;

      const result = await service.getBySlackTeamId('TNOTFOUND');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('sets document with slackTeamId as doc ID', async () => {
      await service.create(mockTeam);
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('T12345');
      expect(mocks.mockDocRef.set).toHaveBeenCalledWith(mockTeam);
    });
  });

  describe('update', () => {
    it('updates document with provided fields', async () => {
      await service.update('T12345', { teamName: 'Updated Team' });
      expect(mocks.mockDocRef.update).toHaveBeenCalledWith({ teamName: 'Updated Team' });
    });
  });

  describe('delete', () => {
    it('deletes document by slackTeamId', async () => {
      await service.delete('T12345');
      expect(mocks.mockDocRef.delete).toHaveBeenCalled();
    });
  });
});
