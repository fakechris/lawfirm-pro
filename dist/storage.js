// Simple storage service mock for testing
export const storageService = {
    getFile: jest.fn().mockResolvedValue(Buffer.from('test file content')),
    uploadFile: jest.fn().mockResolvedValue({
        success: true,
        filePath: '/test/path/file.txt',
        filename: 'file.txt',
        size: 100,
        mimeType: 'text/plain'
    }),
    deleteFile: jest.fn().mockResolvedValue(true),
    fileExists: jest.fn().mockResolvedValue(true)
};
