export function escapeRegExpChars(text: string) {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}
