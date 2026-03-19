import { tokenize, Token } from '../tokenizer';
describe('Tokenizer', () => {
    describe('Basic tokenization', () => {
        it('should tokenize a simple command', () => {
            const tokens: Token[] = tokenize('/list');
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe('command');
            expect(tokens[0].value).toBe('list');
        });
        it('should tokenize a command with subcommand', () => {
            const tokens: Token[] = tokenize('/list stories');
            expect(tokens).toHaveLength(2);
            expect(tokens[0].type).toBe('command');
            expect(tokens[0].value).toBe('list');
            expect(tokens[1].type).toBe('argument');
            expect(tokens[1].value).toBe('stories');
        });
        it('should tokenize a command with arguments', () => {
            const tokens: Token[] = tokenize('/view story "user login"');
            expect(tokens).toHaveLength(3);
            expect(tokens[0].type).toBe('command');
            expect(tokens[0].value).toBe('view');
            expect(tokens[1].type).toBe('argument');
            expect(tokens[1].value).toBe('story');
            expect(tokens[2].type).toBe('argument');
            expect(tokens[2].value).toBe('user login');
        });
        it('should handle quoted strings with spaces', () => {
            const tokens: Token[] = tokenize('/search "authentication flow"');
            expect(tokens).toHaveLength(2);
            expect(tokens[0].type).toBe('command');
            expect(tokens[0].value).toBe('search');
            expect(tokens[1].type).toBe('argument');
            expect(tokens[1].value).toBe('authentication flow');
        });
        it('should handle single quotes', () => {
            const tokens: Token[] = tokenize("/search 'test query'");
            expect(tokens).toHaveLength(2);
            expect(tokens[1].value).toBe('test query');
        });
    });
    describe('Option tokenization', () => {
        it('should tokenize long options', () => {
            const tokens: Token[] = tokenize('/list stories --json');
            expect(tokens).toHaveLength(3);
            expect(tokens[2].type).toBe('option');
            expect(tokens[2].value).toBe('json');
        });
        it('should tokenize short options', () => {
            const tokens: Token[] = tokenize('/list stories -j');
            expect(tokens).toHaveLength(3);
            expect(tokens[2].type).toBe('option');
            expect(tokens[2].value).toBe('j');
        });
        it('should tokenize options with values', () => {
            const tokens: Token[] = tokenize('/list stories --filter login');
            expect(tokens).toHaveLength(4);
            expect(tokens[2].type).toBe('option');
            expect(tokens[2].value).toBe('filter');
            expect(tokens[3].type).toBe('option-value');
            expect(tokens[3].value).toBe('login');
        });
        it('should handle multiple options', () => {
            const tokens: Token[] = tokenize(
                '/list stories --json --filter test'
            );
            expect(tokens).toHaveLength(5);
            expect(tokens[2].type).toBe('option');
            expect(tokens[2].value).toBe('json');
            expect(tokens[3].type).toBe('option');
            expect(tokens[3].value).toBe('filter');
            expect(tokens[4].type).toBe('option-value');
            expect(tokens[4].value).toBe('test');
        });
    });
    describe('Edge cases', () => {
        it('should handle empty string', () => {
            const tokens: Token[] = tokenize('');
            expect(tokens).toHaveLength(0);
        });
        it('should handle command with only spaces', () => {
            const tokens: Token[] = tokenize('   ');
            expect(tokens).toHaveLength(0);
        });
        it('should handle multiple spaces between tokens', () => {
            const tokens: Token[] = tokenize('/list    stories');
            expect(tokens).toHaveLength(2);
            expect(tokens[0].value).toBe('list');
            expect(tokens[1].value).toBe('stories');
        });
        it('should preserve quoted strings with special characters', () => {
            const tokens: Token[] = tokenize('/search "test & query"');
            expect(tokens).toHaveLength(2);
            expect(tokens[1].value).toBe('test & query');
        });
    });
});
