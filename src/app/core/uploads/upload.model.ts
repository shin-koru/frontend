export type UploadPurpose = 'avatar' | 'poster' | 'video';
export type UploadStatus =
  | 'ready'
  | 'hashing'
  | 'uploading'
  | 'paused'
  | 'verifying'
  | 'saving'
  | 'complete'
  | 'error'
  | 'cancelling'
  | 'cancelled';
export interface UploadedFile {
  objectKey: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
}
export interface UploadRecord {
  key: string;
  owner: string;
  purpose: UploadPurpose;
  contentId?: string;
  episodeId?: string;
  name: string;
  size: number;
  modified: number;
  checksum?: string;
  sessionId?: string;
  result?: UploadedFile;
  status: UploadStatus;
  progress: number;
  error?: string;
}
export interface MultipartSession {
  sessionId: string;
  partSize: number;
  partCount: number;
  status: string;
  expiresAt: string;
  parts: { partNumber: number; size: number; etag: string }[];
}
