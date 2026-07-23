import { describe, it, expect } from 'vitest';
import { extractTitleAndDescription } from './nodeIndex';

describe('extractTitleAndDescription', () => {
  it('extracts the title and a heading-named description (feature schema)', () => {
    const content = `# Checkout\n\n## Summary\nLets a user pay for their cart.\n\n## Behavior\n...`;
    const { title, description } = extractTitleAndDescription(content);
    expect(title).toBe('Checkout');
    expect(description).toBe('Lets a user pay for their cart.');
  });

  it('extracts a plain paragraph with no heading (data_model schema)', () => {
    const content = `# Order\n\nOne order per checkout attempt.\n\n## Fields\n| Field | Type |\n|---|---|`;
    const { title, description } = extractTitleAndDescription(content);
    expect(title).toBe('Order');
    expect(description).toBe('One order per checkout attempt.');
  });

  it('extracts from a differently-named heading (business_rule uses Statement, not Summary)', () => {
    const content = `# BR-0001: Email must be unique\n\n## Statement\nEach email may only be used by one active account.`;
    const { title, description } = extractTitleAndDescription(content);
    expect(title).toBe('BR-0001: Email must be unique');
    expect(description).toBe('Each email may only be used by one active account.');
  });

  it('falls back to title-only when there is no body text at all', () => {
    const { title, description } = extractTitleAndDescription('# Order\n');
    expect(title).toBe('Order');
    expect(description).toBeNull();
  });

  it('returns nulls for content with no title heading at all', () => {
    const { title, description } = extractTitleAndDescription('Just some stray text, no heading.\n');
    expect(title).toBeNull();
    expect(description).toBeNull();
  });

  it('skips a table row and a horizontal rule when looking for the first real paragraph', () => {
    const content = `# POST /orders/checkout\n\n---\n\nCreates a new order from the current cart.\n\n## Request\n| Header | Required |`;
    const { description } = extractTitleAndDescription(content);
    expect(description).toBe('Creates a new order from the current cart.');
  });

  it('truncates a long paragraph at the nearest sentence boundary within the cap', () => {
    const sentence = 'This rule exists because duplicate accounts caused support escalations in the past.';
    const content = `# BR-0002\n\n## Statement\n${sentence} A second sentence that should be cut off entirely because it runs past the cap.`;
    const { description } = extractTitleAndDescription(content);
    expect(description).toBe(sentence);
    expect(description!.length).toBeLessThanOrEqual(120);
  });

  it('hard-truncates with an ellipsis when even the first sentence exceeds the cap', () => {
    const longSentence = 'A'.repeat(150) + ' no period anywhere in this run-on text at all here';
    const content = `# X\n\n${longSentence}`;
    const { description } = extractTitleAndDescription(content);
    expect(description!.endsWith('…')).toBe(true);
    expect(description!.length).toBeLessThanOrEqual(121); // 120 + ellipsis char
  });
});
