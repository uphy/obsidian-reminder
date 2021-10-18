export class DependencyGraph<V> {
    private nodes: Array<DependencyNode<V>> = [];
    private valueToNode: Map<V, DependencyNode<V>> = new Map();
    public resolveValue(): Array<V> {
        return this.resolve().map((n) => n.value);
    }
    public resolve(): Array<DependencyNode<V>> {
        for (const node of this.nodes) {
            node.resolveNode(new Set());
        }
        return this.nodes.sort(DependencyNode.compare);
    }
    public createNode(value: V): DependencyNode<V> {
        const n = new DependencyNode(value);
        this.nodes.push(n);
        this.valueToNode.set(value, n);
        return n;
    }
    public getNodeByValue(value: V): DependencyNode<V> | undefined {
        return this.valueToNode.get(value);
    }
}

export class CyclicDependencyError extends Error {
    constructor(public node: any) {
        super();
    }
}

class DependencyNode<V> {
    private dependents: Array<DependencyNode<V>> = [];
    private order: number = 0;
    constructor(private _value: V) {}
    public dependsOn(node: DependencyNode<V>) {
        this.dependents.push(node);
    }
    resolveNode(unresolved: Set<DependencyNode<V>>) {
        if (unresolved.has(this)) {
            throw new CyclicDependencyError(this.value);
        }
        unresolved.add(this);
        const dependentsOrder = this.order + 1;
        for (const dependent of this.dependents) {
            if (dependent.order < dependentsOrder) {
                dependent.order = dependentsOrder;
            }
            dependent.resolveNode(unresolved);
        }
        unresolved.delete(this);
    }
    get value() {
        return this._value;
    }
    static compare<V>(a: DependencyNode<V>, b: DependencyNode<V>): number {
        return b.order - a.order;
    }
}
