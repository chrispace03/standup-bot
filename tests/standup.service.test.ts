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

  describe('getByIssueKey', () => {
    it('returns standups where the issue appears in yesterday or today', async () => {
      const standup1: StandupRecord = {
        ...mockStandup,
        userId: 'U1',
        date: '2026-03-04',
        yesterday: [{ issueKey: 'PROJ-10', summary: 'Task A', status: 'Done', issueType: 'Story', url: '' }],
        today: [],
      };
      const standup2: StandupRecord = {
        ...mockStandup,
        userId: 'U2',
        date: '2026-03-05',
        yesterday: [],
        today: [{ issueKey: 'PROJ-10', summary: 'Task A', status: 'In Progress', issueType: 'Story', url: '' }],
      };
      const standup3: StandupRecord = {
        ...mockStandup,
        userId: 'U3',
        date: '2026-03-05',
        yesterday: [{ issueKey: 'PROJ-99', summary: 'Other', status: 'Done', issueType: 'Bug', url: '' }],
        today: [],
      };

      mocks.mockQuerySnapshot.docs = [
        { data: () => standup1 },
        { data: () => standup2 },
        { data: () => standup3 },
      ];

      const result = await service.getByIssueKey('PROJ-10');
      expect(result).toHaveLength(2);
      expect(mocks.mockCollection.orderBy).toHaveBeenCalledWith('date', 'desc');
    });

    it('respects the limit parameter', async () => {
      const standups = Array.from({ length: 5 }, (_, i) => ({
        ...mockStandup,
        userId: `U${i}`,
        date: `2026-03-0${i + 1}`,
        yesterday: [{ issueKey: 'PROJ-10', summary: 'Task', status: 'Done', issueType: 'Story', url: '' }],
        today: [],
      }));

      mocks.mockQuerySnapshot.docs = standups.map((s) => ({ data: () => s }));

      const result = await service.getByIssueKey('PROJ-10', 2);
      expect(result).toHaveLength(2);
    });

    it('defaults to limit of 10', async () => {
      mocks.mockQuerySnapshot.docs = [];
      await service.getByIssueKey('PROJ-10');
      expect(mocks.mockCollection.limit).toHaveBeenCalledWith(50);
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
