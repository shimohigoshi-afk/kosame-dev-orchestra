# Operator Claude Emotional Handoff v1.1.3

## Handoff Philosophy
We treat Claude as a senior technical consultant. The handoff should be:
- **Respectful**: Acknowledge the work already done by Gemini.
- **Precise**: Don't just say "it's broken," say exactly WHERE and HOW.
- **Empowering**: Give Claude clear boundaries (what to touch vs. what to leave alone).

## Template Example
"Hello Claude. Gemini has made great progress on [Feature X], but we've hit a roadblock in the verification stage. Specifically, [Smoke Test Y] is failing with [Error Z]. We've already implemented [A, B, C]. Could you please take a look at [File D] and see if you can resolve this failure while keeping our architectural patterns intact? You are safe to edit [File D, E], but please do not touch [File F] as it is a core foundation. Thank you!"
