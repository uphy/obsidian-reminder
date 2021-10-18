import { CyclicDependencyError, DependencyGraph } from './dependency';

describe('DependencyGraph', (): void => {
    test('resolve()', (): void => {
        const sut = new DependencyGraph<string>();
        const a = sut.createNode('a');
        const b = sut.createNode('b');
        const c = sut.createNode('c');
        const d = sut.createNode('d');
        const e = sut.createNode('e');
        const f = sut.createNode('f');
        expect(sut.getNodeByValue('a')).toBe(a);
        expect(sut.getNodeByValue('c')).toBe(c);
        expect(sut.getNodeByValue('f')).toBe(f);

        b.dependsOn(a);
        c.dependsOn(b);
        c.dependsOn(f);
        d.dependsOn(b);
        f.dependsOn(e);
        f.dependsOn(d);
        e.dependsOn(a);

        const resolved = sut.resolveValue();
        expect(resolved).toStrictEqual(['a', 'b', 'd', 'e', 'f', 'c']);
    });
    test('resolve() - cycle', (): void => {
        const sut = new DependencyGraph<string>();
        const a = sut.createNode('a');
        const b = sut.createNode('b');
        const c = sut.createNode('c');

        a.dependsOn(b);
        b.dependsOn(c);
        c.dependsOn(a);
        try {
            sut.resolveValue();
        } catch (e) {
            expect(e).toBeInstanceOf(CyclicDependencyError);
        }
    });
});
