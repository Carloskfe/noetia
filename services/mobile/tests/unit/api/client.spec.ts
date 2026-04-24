describe('apiClient module guard', () => {
  it('throws when EXPO_PUBLIC_API_URL is not set', () => {
    const saved = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.resetModules();
    expect(() => require('../../../src/api/client')).toThrow('EXPO_PUBLIC_API_URL is not set');
    process.env.EXPO_PUBLIC_API_URL = saved;
    jest.resetModules();
  });
});

describe('apiClient', () => {
  let apiClient: typeof import('../../../src/api/client').apiClient;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://test-api.local';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    apiClient = require('../../../src/api/client').apiClient;
  });

  afterEach(() => jest.restoreAllMocks());

  const mockFetchOk = (body: unknown) => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response);
  };

  describe('get', () => {
    it('calls fetch with the correct GET URL', async () => {
      mockFetchOk({ items: [] });
      await apiClient.get('/books');
      expect(global.fetch).toHaveBeenCalledWith('http://test-api.local/books');
    });

    it('returns the parsed JSON response', async () => {
      mockFetchOk({ title: 'Book A' });
      const result = await apiClient.get('/books/1');
      expect(result).toEqual({ title: 'Book A' });
    });
  });

  describe('post', () => {
    it('calls fetch with POST method and JSON body', async () => {
      mockFetchOk({ id: 'new-id' });
      await apiClient.post('/books', { title: 'New Book' });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/books',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Book' }),
        }),
      );
    });

    it('returns the parsed JSON response', async () => {
      mockFetchOk({ id: 'created' });
      const result = await apiClient.post('/books', {});
      expect(result).toEqual({ id: 'created' });
    });
  });

  describe('patch', () => {
    it('calls fetch with PATCH method and JSON body', async () => {
      mockFetchOk({ id: '1', title: 'Updated' });
      await apiClient.patch('/books/1', { title: 'Updated' });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/books/1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated' }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('calls fetch with DELETE method', async () => {
      mockFetchOk({});
      await apiClient.delete('/books/1');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/books/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
