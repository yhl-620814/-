/**
 * Verification vector test suite for the Dirty Dozen payloads defined in security_spec.md.
 * Run against Firebase Rules Emulator when available.
 */
export const dirtyDozenVectors = [
  {
    name: '1. Unauthenticated read on /users/{uid}',
    auth: null,
    operation: 'get',
    path: '/users/user_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email spoofing admin email',
    auth: { uid: 'spoof_1', token: { email: 'yhl@tmail.ilc.edu.tw', email_verified: false } },
    operation: 'create',
    path: '/uploadTopics/topic_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Non-Tmail Gmail user reading /uploadTopics',
    auth: { uid: 'gmail_1', token: { email: 'teacher@gmail.com', email_verified: true } },
    operation: 'list',
    path: '/uploadTopics',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Verified Tmail user reading another user profile PII',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'get',
    path: '/users/user_2',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Non-admin listing /users collection',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'list',
    path: '/users',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Non-admin creating /uploadTopics or /uploadItems',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'create',
    path: '/uploadTopics/topic_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Shadow update injecting extra field into /users/{uid}',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'update',
    path: '/users/user_1',
    payload: { isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Spoofed uploadedByUid when creating /uploadHistory',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'create',
    path: '/uploadHistory/hist_1',
    payload: { uploadedByUid: 'user_2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Orphaned history record referencing non-existent itemId',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'create',
    path: '/uploadHistory/hist_1',
    payload: { itemId: 'missing_item' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Forged createdAt timestamp not equal to request.time',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'create',
    path: '/users/user_1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Non-admin updating review status on /uploadHistory',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'update',
    path: '/uploadHistory/hist_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Non-admin listing all /uploadHistory across all schools',
    auth: { uid: 'user_1', token: { email: 'a@tmail.ilc.edu.tw', email_verified: true } },
    operation: 'list',
    path: '/uploadHistory',
    expected: 'PERMISSION_DENIED',
  },
];
