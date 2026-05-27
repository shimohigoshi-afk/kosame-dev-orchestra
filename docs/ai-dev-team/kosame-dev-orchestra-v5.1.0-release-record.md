# KOSAME Dev Orchestra v5.1.0 Provider Pool Policy Pack

## Purpose

This release introduces a formal provider pool policy that governs which providers are available for concurrent use and defines compliance limits.

## Provider Pool Structure

- Primary Pool: kosame, claude, gemini
- Secondary Pool: grok, deepseek, kimi
- Execution Pool: cloudShell (human-approved only)
- Approval Pool: human (final YES authority)

## Pool Policy

- Maximum 2 external providers may be active concurrently.
- Execution and approval tiers always require human approval.
- Pool compliance is evaluated before task dispatch.

## Release Value

v5.1.0 adds structured pool governance so こさめ副社長 can enforce concurrency limits and track which providers are active at any given time.
