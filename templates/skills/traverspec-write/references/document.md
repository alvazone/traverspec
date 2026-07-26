# Evidence calibration: a document

Apply this when the evidence includes an existing document — a PDF, notes, pasted text, a Notion page, anything already written down.

The core risk here is **confidently structuring an ambiguous fact as if it were a clean one.** A document almost always mixes facts that map cleanly onto a node or edge — "the checkout feature creates an Order record" is unambiguously a `mutates` edge from `feature:checkout` to `data_model:Order` — with facts that are true but ambiguous in how they should be structured. Two different agents converting the same document shouldn't produce meaningfully different graphs; when they would, that's the moment to flag it under *Confidence-gating* rather than pick an interpretation silently.

Specific low-confidence triggers for document evidence:
- The content could reasonably be split into more than one node, or merged into fewer, and the right granularity isn't obvious (apply the granularity test: would anything ever need to fetch this piece independently?).
- A relationship is implied but not stated — two things mentioned in the same paragraph, with no explicit connection given. Don't infer an edge type from proximity in the text.
- Something could plausibly be a `business_rule` or just incidental detail inside a `feature`, and the document's own structure doesn't make it clear which was intended.

**If the evidence is a full document, not a fragment someone pasted into chat:** read the whole thing before writing any node from it — you need the overall shape before deciding where boundaries fall, not just the section in front of you. Identify likely `epic` groupings from the document's own top-level structure, if it has one; this is low-stakes to get slightly wrong, since epics are labels, not structural commitments. And hold off on the shared-`data_model` dependency check (*Writing it*, in `SKILL.md`) until you've worked through the whole document — that's the batch boundary here, per the loop's step 2 — because an early section can't tell you what a later section will reveal about who else touches the same model.
