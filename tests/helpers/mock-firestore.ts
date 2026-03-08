export function createMockFirestore() {
  const mockDocSnapshot = {
    exists: true,
    data: jest.fn(),
    id: 'mock-id',
  };

  const mockDocRef = {
    get: jest.fn().mockResolvedValue(mockDocSnapshot),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockQuerySnapshot = {
    docs: [] as Array<{ data: () => unknown }>,
    empty: true,
    forEach: jest.fn(),
  };

  const mockCollection = {
    doc: jest.fn().mockReturnValue(mockDocRef),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(mockQuerySnapshot),
    withConverter: jest.fn().mockReturnThis(),
  };

  const db = {
    collection: jest.fn().mockReturnValue(mockCollection),
  } as unknown as FirebaseFirestore.Firestore;

  return { db, mockCollection, mockDocRef, mockDocSnapshot, mockQuerySnapshot };
}
