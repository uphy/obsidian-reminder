import { Reminder } from './reminder';

describe('Reminder', (): void => {
    test('extractFileName()', (): void => {
        expect(Reminder.extractFileName('/dir1/dir2/file')).toBe('file');
        expect(Reminder.extractFileName('/dir1/dir2/file.md')).toBe('file');
        expect(Reminder.extractFileName('/dir1/dir2/file.md.zip')).toBe('file');
        expect(Reminder.extractFileName('/dir1/dir2/file.')).toBe('file.');

        expect(Reminder.extractFileName('file.md')).toBe('file');
    });
});
