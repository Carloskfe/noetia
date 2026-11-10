import { StorageBookText } from '../../../../src/knowledge/retrieval/storage-book-text';

describe('StorageBookText (S2 runtime adapter)', () => {
  it('reads exact bytes from the private books bucket through StorageService.getBytes', async () => {
    const storage = { getBytes: jest.fn().mockResolvedValue(Buffer.from([1, 2, 3])) };
    const port = new StorageBookText(storage as any);
    expect([...(await port.read('texts/x.txt'))]).toEqual([1, 2, 3]);
    expect(storage.getBytes).toHaveBeenCalledWith('texts/x.txt', 'books');
  });
  it('propagates storage failures (callers fail closed)', async () => {
    const port = new StorageBookText({ getBytes: jest.fn().mockRejectedValue(new Error('down')) } as any);
    await expect(port.read('k')).rejects.toThrow('down');
  });
});
