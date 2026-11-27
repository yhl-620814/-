# Firestore Security Specification

## 1. Data Invariants
1. Only Google-verified `@tmail.ilc.edu.tw` accounts (`request.auth.token.email_verified == true && request.auth.token.email.matches('.*@tmail\\.ilc\\.edu\\.tw$')`) may access domain resources.
2. Administrator privileges belong strictly to the verified runtime admin email (`yhl@tmail.ilc.edu.tw`).
3. Users can only read or write their own `/users/{userId}` profile document containing their PII (`email`).
4. Only the administrator may create, update, or delete `/uploadTopics/{topicId}` and `/uploadItems/{itemId}`.
5. A submission and its corresponding `/uploadHistory/{historyId}` entry cannot be created without referencing an existing `/uploadItems/{itemId}` and matching the authenticated user's `uid` and `email`.
6. Once a submission reaches `'approved'` status, non-admin users cannot overwrite or modify it.
7. Every `create` and `update` enforces strict field allowlisting (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update), server-verified timestamps (`request.time`), and bounded string/number constraints.
8. `allow list` rules never call `get()` or `exists()` and strictly filter by `resource.data.uploadedByUid == request.auth.uid` or `isAdmin()`.

## 2. The Dirty Dozen Adversarial Payloads
1. Unauthenticated read on `/users/{uid}` -> DENIED.
2. Unverified email (`email_verified: false`) pretending to be `yhl@tmail.ilc.edu.tw` -> DENIED.
3. Non-Tmail Gmail user (`user@gmail.com`) reading `/uploadTopics` or `/uploadItems` -> DENIED.
4. User reading another user's `/users/{otherUid}` PII profile -> DENIED.
5. User listing `/users` collection -> DENIED.
6. User creating `/uploadTopics/{id}` or `/uploadItems/{id}` (privilege escalation) -> DENIED.
7. Shadow update adding `isAdmin: true` or `extraField: 1` to `/users/{uid}` -> DENIED.
8. Spoofed `uploadedByUid` or `uploadedByEmail` when creating `/submissions/{id}` or `/uploadHistory/{id}` -> DENIED.
9. Orphaned submission or history record referencing non-existent `itemId` -> DENIED.
10. Client-forged `createdAt` or `updatedAt` timestamp not equal to `request.time` -> DENIED.
11. Non-admin updating an `'approved'` submission or reviewing `/uploadHistory/{id}` -> DENIED.
12. Non-admin listing all `/submissions` or `/uploadHistory` across all schools -> DENIED.
