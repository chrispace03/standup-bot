import { UserService } from '../src/services/user.service';
import { createMockFirestore } from './helpers/mock-firestore';
import { User } from '../src/models';

const mockUser: User = {
  slackUserId: 'U12345',
  slackTeamId: 'T12345',
  displayName: 'Test User',
  email: 'test@example.com',
  timezone: 'Australia/Brisbane',
  standupTime: '09:00',
  standupEnabled: true,
  standupDays: [1, 2, 3, 4, 5],
  googleConnected: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('UserService', () => {
  let service: UserService;
  let mocks: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    mocks = createMockFirestore();
    service = new UserService(mocks.db);
  });

  describe('getBySlackId', () => {
    it('returns user when document exists', async () => {
      mocks.mockDocSnapshot.exists = true;
      mocks.mockDocSnapshot.data.mockReturnValue(mockUser);

      const result = await service.getBySlackId('U12345');
      expect(result).toEqual(mockUser);
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('U12345');
    });

    it('returns null when document does not exist', async () => {
      mocks.mockDocSnapshot.exists = false;

      const result = await service.getBySlackId('UNOTFOUND');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('sets document with slackUserId as doc ID', async () => {
      await service.create(mockUser);
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('U12345');
      expect(mocks.mockDocRef.set).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('update', () => {
    it('updates document with provided fields', async () => {
      await service.update('U12345', { displayName: 'Updated Name' });
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('U12345');
      expect(mocks.mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Updated Name' })
      );
    });
  });

  describe('getByTeam', () => {
    it('queries by slackTeamId', async () => {
      mocks.mockQuerySnapshot.docs = [{ data: () => mockUser }];

      const result = await service.getByTeam('T12345');
      expect(mocks.mockCollection.where).toHaveBeenCalledWith('slackTeamId', '==', 'T12345');
      expect(result).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('deletes document by slackUserId', async () => {
      await service.delete('U12345');
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('U12345');
      expect(mocks.mockDocRef.delete).toHaveBeenCalled();
    });
  });
});
