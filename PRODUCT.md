# Product

## Register

product

## Users

Students actively hunting for their next opportunity — internships, competitions, hackathons. They open OpportunityScout with a real question: "which of these is actually worth my time, and why?" They're often deadline-pressured, juggling applications, and skeptical of generic job-board noise. No secondary audience — this is built for the student, full stop.

## Product Purpose

OpportunityScout exists to give students AI-tailored match reasoning, not a flat list of postings. Success is the moment a student reads the reasoning on a card and thinks "yes, that's exactly why this fits me" — or "no, that's not relevant, skip." The product earns its keep by making the *why* legible and fast, turning a scattered discovery process into a confident decision.

## Brand Personality

Confident, encouraging, sharp, bold. The voice knows what it's talking about and says it plainly — no hedging, no filler. It treats the student as capable, not coddled. Encouragement comes from clarity and momentum, not from soft language. Bold means the UI commits to its choices; it doesn't whisper.

## Anti-references

- **Redesign from scratch.** Do not preserve, reference, or react to anything currently in the frontend. The new design starts from a blank page — no inherited palette, structure, or effects.
- **Linear layout websites.** No single-column scroll of stacked sections that all behave the same way. The interface should have spatial depth — panels, layering, branching paths — not a straight line top to bottom.
- **Generic job-board aesthetics.** No LinkedIn-gray, no Indeed-blue, no flat card grids of identical postings.

## Design Principles

1. **Show the reasoning, don't hide it.** The AI's match logic is the product. It gets visual primacy, not a footnote. If a card can't make the *why* obvious in two seconds, the design failed.
2. **Bold commits, not safe defaults.** Every surface makes a choice. Maximalism where it earns attention (hero moments, match scores), restraint where it serves clarity (the reasoning text itself). No timid middle.
3. **Spatial, not flat.** The interface has depth — glassmorphism, layering, panels that slide and stack. It feels like a workspace you move through, not a flat list of rows.
4. **Encouraging through momentum.** The UI keeps the student moving toward a decision. Friction is the enemy; every interaction should feel like progress.
5. **Premium tool, not toy.** Raycast / Vercel / Render energy — sharp, fast, technically credible. A student should feel like they're using something serious, not a "student" product that's been dumbed down.

## Accessibility & Inclusion

WCAG AA. Respect `prefers-reduced-motion` (the glassmorphism and depth effects need static fallbacks). Never rely on color alone to convey match strength or eligibility. Body text contrast ≥ 4.5:1 against its background, including any text layered on glass surfaces.
