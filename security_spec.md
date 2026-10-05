# Security Specification for Geosphere Beta Tester Gatekeeping

## 1. Data Invariants
- A beta tester record belongs strictly to the user matching their authenticated user ID (`request.auth.uid`).
- A user's beta tester record is immutable. Once created, it cannot be edited or deleted by the user client to prevent resetting the 30-day trial clock.
- The `email` and `name` properties must be valid strings, while `joinedAt` and `trialEndsAt` must be valid integers.

## 2. The "Dirty Dozen" Payloads (Denial Tests)
We must verify that all malicious payloads return `PERMISSION_DENIED`.

1. **Unauthenticated Creation**: Attempting to register a beta tester when not signed in.
2. **Identity Spoofing**: Attempting to create a document for user `B` while authenticated as user `A`.
3. **Ghost Fields Injection**: Attempting to register with additional fields (e.g., `isAdmin: true` or `unauthorizedField: "ghost"`).
4. **Incorrect Data Type**: Attempting to pass `joinedAt` as a string instead of an integer.
5. **Junk Character Document ID**: Attempting to register with a 1.5KB string or invalid characters in the user ID path.
6. **Modifying an Existing Trial**: Attempting to update the `trialEndsAt` timestamp to extend the trial.
7. **Deleting a Trial Record**: Attempting to delete the `beta_testers/{userId}` record to reset the trial on re-registration.
8. **Null Payload Fields**: Attempting to create a document missing required fields like `trialEndsAt`.
9. **Volumetric Overflow**: Attempting to write a 1MB string into the user's `name` or `email` fields.
10. **Blanket Query Scraping**: Attempting to list all beta testers instead of fetching a single user record.
11. **Spoofed Email / Verifications**: Attempting to bypass the authentication flow without a valid credential.
12. **Tampered Expiry Epoch**: Passing a negative integer or decimal float for timestamps.
