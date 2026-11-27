import type { Timestamp } from 'firebase/firestore';

export type SchoolLevel = '國小' | '國中' | '高中職' | '特教';

export interface YilanSchool {
  id: string;
  name: string;
  township: string;
  level: SchoolLevel;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  schoolId: string;
  schoolName: string;
  schoolTownship: string;
  schoolLevel: SchoolLevel;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UploadTopic {
  id: string;
  title: string;
  description: string;
  active: boolean;
  sortOrder: number;
  createdByUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UploadItem {
  id: string;
  topicId?: string;
  topicTitle?: string;
  title: string;
  description: string;
  acceptedFormats: string;
  maxSizeMB: number;
  deadline: string;
  isRequired: boolean;
  active: boolean;
  sortOrder: number;
  createdByUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type SubmissionStatus = 'uploaded' | 'approved' | 'rejected';

export interface SubmissionRecord {
  id: string;
  schoolId: string;
  schoolName: string;
  itemId: string;
  itemTitle: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  driveFileId: string;
  driveWebViewLink: string;
  sharedWithAdmin: boolean;
  uploadedByUid: string;
  uploadedByEmail: string;
  uploadedByName: string;
  status: SubmissionStatus;
  reviewNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UploadHistoryRecord {
  id: string;
  submissionId: string;
  schoolId: string;
  schoolName: string;
  topicTitle: string;
  itemId: string;
  itemTitle: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  driveFileId: string;
  driveWebViewLink: string;
  uploadedByUid: string;
  uploadedByEmail: string;
  uploadedByName: string;
  status: SubmissionStatus;
  reviewNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SchoolItemStatus {
  schoolId: string;
  itemId: string;
  status: SubmissionStatus;
  fileName: string;
  fileSize: number;
  driveFileId: string;
  driveWebViewLink: string;
  uploadedByUid: string;
  uploadedByName: string;
  reviewNote: string;
  updatedAt?: Timestamp;
}

export interface AppDriveSettings {
  adminEmail: string;
  targetFolderId: string;
  targetFolderName: string;
  targetFolderUrl: string;
  updatedAt?: Timestamp;
}

// Validation limits synchronized verbatim with firebase-blueprint.json & firestore.rules
export const FIELD_LIMITS = {
  TITLE_MAX: 120,
  DESCRIPTION_MAX: 600,
  ACCEPTED_FORMATS_MAX: 120,
  MAX_SIZE_MB_LIMIT: 100,
  DEADLINE_MAX: 40,
  FILENAME_MAX: 255,
  REVIEW_NOTE_MAX: 400,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
} as const;

export const ADMIN_TMAIL_EMAIL = 'yhl@tmail.ilc.edu.tw';
export const TMAIL_DOMAIN = '@tmail.ilc.edu.tw';
