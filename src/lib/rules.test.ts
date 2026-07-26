import { describe, it, expect } from 'vitest';
import {
  checkStructuralShape,
  checkTypeLegality,
  checkOverridesDirection,
  checkSequentialNumbering,
  checkGraphYamlSubsetCompatibility,
} from './rules';

describe('checkStructuralShape', () => {
  it('passes a well-formed graph', () => {
    const raw = {
      epics: [{ id: 'epic:billing', name: 'Billing', path: 'assets/epic/billing.md' }],
      nodes: [{ id: 'feature:checkout', type: 'feature', path: 'assets/feature/checkout.md', epic: 'epic:billing' }],
      edges: [{ from: 'feature:checkout', type: 'mutates', to: 'data_model:Order' }],
    };
    expect(checkStructuralShape(raw)).toEqual([]);
  });

  it('flags an edge with an extra key from a merged/misindented entry', () => {
    const raw = {
      epics: [],
      nodes: [],
      edges: [{ from: 'feature:checkout', type: 'mutates', to: 'data_model:Order', extra: 'oops' }],
    };
    const findings = checkStructuralShape(raw);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe('structural-shape');
    expect(findings[0].message).toContain('extra');
  });

  it('flags a node missing a required key', () => {
    const raw = {
      epics: [],
      nodes: [{ id: 'feature:checkout', type: 'feature' }], // missing path
      edges: [],
    };
    const findings = checkStructuralShape(raw);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain('missing');
  });

  it('flags a nested structure where a scalar is expected', () => {
    const raw = {
      epics: [],
      nodes: [{ id: 'feature:checkout', type: 'feature', path: { nested: 'oops' } }],
      edges: [],
    };
    const findings = checkStructuralShape(raw);
    expect(findings.some((f) => f.message.includes('nested structure'))).toBe(true);
  });
});

describe('checkTypeLegality', () => {
  it('passes legal node and edge types', () => {
    const raw = {
      nodes: [{ id: 'feature:checkout', type: 'feature' }],
      edges: [{ from: 'a', type: 'dispatches', to: 'b' }],
    };
    expect(checkTypeLegality(raw)).toEqual([]);
  });

  it('flags an illegal node type', () => {
    const raw = { nodes: [{ id: 'feature:checkout', type: 'ui_widget' }], edges: [] };
    const findings = checkTypeLegality(raw);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain("illegal type 'ui_widget'");
  });

  it('flags an illegal edge type (typo)', () => {
    const raw = { nodes: [], edges: [{ from: 'a', type: 'depnds_on', to: 'b' }] };
    const findings = checkTypeLegality(raw);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain("illegal type 'depnds_on'");
  });

  it('does not enforce which node types an edge connects (non-typical pairing is legal)', () => {
    // data_model --enforces--> business_rule is non-typical but explicitly allowed
    const raw = {
      nodes: [
        { id: 'data_model:Order', type: 'data_model' },
        { id: 'business_rule:BR-0001', type: 'business_rule' },
      ],
      edges: [{ from: 'data_model:Order', type: 'enforces', to: 'business_rule:BR-0001' }],
    };
    expect(checkTypeLegality(raw)).toEqual([]);
  });
});

describe('checkOverridesDirection', () => {
  it('passes a correctly-directed overrides edge', () => {
    const raw = {
      nodes: [
        { id: 'decision:DC-0001', type: 'decision' },
        { id: 'business_rule:BR-0001', type: 'business_rule' },
      ],
      edges: [{ from: 'decision:DC-0001', type: 'overrides', to: 'business_rule:BR-0001' }],
    };
    expect(checkOverridesDirection(raw)).toEqual([]);
  });

  it('flags an overrides edge pointing the wrong direction', () => {
    const raw = {
      nodes: [
        { id: 'decision:DC-0001', type: 'decision' },
        { id: 'business_rule:BR-0001', type: 'business_rule' },
      ],
      edges: [{ from: 'business_rule:BR-0001', type: 'overrides', to: 'decision:DC-0001' }],
    };
    const findings = checkOverridesDirection(raw);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe('overrides-direction');
  });

  it('flags an overrides edge from/to the wrong node types entirely', () => {
    const raw = {
      nodes: [
        { id: 'feature:checkout', type: 'feature' },
        { id: 'data_model:Order', type: 'data_model' },
      ],
      edges: [{ from: 'feature:checkout', type: 'overrides', to: 'data_model:Order' }],
    };
    expect(checkOverridesDirection(raw).length).toBe(1);
  });
});

describe('checkSequentialNumbering', () => {
  it('passes a clean, gap-free sequence', () => {
    const raw = {
      nodes: [
        { id: 'business_rule:BR-0001', type: 'business_rule' },
        { id: 'business_rule:BR-0002', type: 'business_rule' },
        { id: 'decision:DC-0001', type: 'decision' },
      ],
    };
    expect(checkSequentialNumbering(raw)).toEqual([]);
  });

  it('flags a gap in the sequence', () => {
    const raw = {
      nodes: [
        { id: 'business_rule:BR-0001', type: 'business_rule' },
        { id: 'business_rule:BR-0003', type: 'business_rule' },
      ],
    };
    const findings = checkSequentialNumbering(raw);
    expect(findings.some((f) => f.message.includes('missing BR-0002'))).toBe(true);
  });

  it('flags a duplicate number', () => {
    const raw = {
      nodes: [
        { id: 'business_rule:BR-0001', type: 'business_rule' },
        { id: 'business_rule:BR-0001', type: 'business_rule' },
      ],
    };
    const findings = checkSequentialNumbering(raw);
    expect(findings.some((f) => f.message.includes('duplicate BR number 1'))).toBe(true);
  });

  it('flags an id that does not match the required format', () => {
    const raw = { nodes: [{ id: 'business_rule:BR-1', type: 'business_rule' }] };
    const findings = checkSequentialNumbering(raw);
    expect(findings.some((f) => f.message.includes('does not match'))).toBe(true);
  });
});

describe('checkGraphYamlSubsetCompatibility', () => {
  it('passes text that is both valid YAML and inside the bundled parser\'s supported subset', () => {
    const text = `epics: []
nodes:
  - id: feature:a
    type: feature
    path: assets/feature/a.md
edges: []
`;
    expect(checkGraphYamlSubsetCompatibility(text)).toEqual([]);
  });

  it('flags legal YAML that the bundled wave-skeleton script cannot parse, without failing to a crash', () => {
    // Quoting is perfectly valid YAML — js-yaml (what `validate` otherwise
    // uses) parses this fine — but it's outside the narrow subset the
    // bundled script supports, which is exactly the gap this check exists
    // to close: a clean `validate` run should not be possible on a file
    // that would still make wave-skeleton.js throw.
    const text = `nodes:
  - id: feature:a
    type: feature
    path: "assets/feature/a.md"
edges: []
epics: []
`;
    const findings = checkGraphYamlSubsetCompatibility(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('graph-yaml-subset');
    expect(findings[0].message).toContain('Fix:');
    expect(findings[0].message).toContain('traverspec validate');
  });
});
