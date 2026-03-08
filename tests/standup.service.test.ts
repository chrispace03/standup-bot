import { StandupService } from '../src/services/standup.service';
import { createMockFirestore } from './helpers/mock-firestore';
import { StandupRecord } from '../src/models';

const mockStandup: StandupRecord = {
  userId: 'U12345',
  date: '2026-03-04',
  yesterday: [{ issueKey: 'PROJ-1', summary: 'Fix bug', status: 'Done', issueType: 'Bug', url: 'https://jira.example.com/PROJ-1' }],
  today: [{ issueKey: 'PROJ-2', summary: 'Build API', status: 'In Progress', issueType: 'Story', url: 'https://jira.example.com/PROJ-2' }],
  blockers: 'None',
  events: [],
};

describe('StandupService', () => {
  let service: StandupService;
  let mocks: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    mocks = createMockFirestore();
    service = new StandupService(mocks.db);
  });

  describe('getById', () => {
    it('uses composite key {date}_{userId}', async () => {
      mocks.mockDocSnapshot.exists = true;
      mocks.mockDocSnapshot.data.mockReturnValue(mockStandup);

      await service.getById('2026-03-04', 'U12345');
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('2026-03-04_U12345');
    });

    it('returns null when not found', async () => {
      mocks.mockDocSnapshot.exists = false;

      const result = await service.getById('2026-03-04', 'UNOTFOUND');
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('saves with composite doc ID', async () => {
      await service.save(mockStandup);
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('2026-03-04_U12345');
      expect(mocks.mockDocRef.set).toHaveBeenCalledWith(mockStandup);
    });
  });

  describe('getHistory', () => {
    it('queries by userId ordered by date desc with limit', async () => {
      mocks.mockQuerySnapshot.docs = [{ data: () => mockStandup }];

      const result = await service.getHistory('U12345', 7);
      expect(mocks.mockCollection.where).toHaveBeenCalledWith('userId', '==', 'U12345');
      expect(mocks.mockCollection.orderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mocks.mockCollection.limit).toHaveBeenCalledWith(7);
      expect(result).toHaveLength(1);
    });

    it('defaults to limit of 14', async () => {
      await service.getHistory('U12345');
      expect(mocks.mockCollection.limit).toHaveBeenCalledWith(14);
    });
  });

  describe('getByDate', () => {
    it('queries all standups for a given date', async () => {
      await service.getByDate('2026-03-04');
      expect(mocks.mockCollection.where).toHaveBeenCalledWith('date', '==', '2026-03-04');
    });
  });

  describe('delete', () => {
    it('deletes with composite key', async () => {
      await service.delete('2026-03-04', 'U12345');
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('2026-03-04_U12345');
      expect(mocks.mockDocRef.delete).toHaveBeenCalled();
    });
  });
});
