/**
 * Avatar Utility Functions
 *
 * Handles avatar file validation, storage, and retrieval.
 * Uses magic byte validation to ensure files are actually images.
 */

import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Configuration
export const AVATAR_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  uploadDir: '/app/data/avatars',
};

// Default avatar SVG embedded as string (avoids file path issues in production)
const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <circle cx="64" cy="64" r="64" fill="#E5E7EB"/>
  <circle cx="64" cy="48" r="20" fill="#9CA3AF"/>
  <ellipse cx="64" cy="100" rx="32" ry="24" fill="#9CA3AF"/>
</svg>`;

export type AllowedMimeType = (typeof AVATAR_CONFIG.allowedMimeTypes)[number];

// Map MIME types to file extensions
const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface AvatarValidationResult {
  valid: boolean;
  mimeType?: AllowedMimeType;
  error?: string;
}

/**
 * Validate image buffer using magic bytes (file signature)
 * This prevents users from uploading malicious files disguised as images
 */
export async function validateImageBuffer(buffer: Buffer): Promise<AvatarValidationResult> {
  // Check file size
  if (buffer.length > AVATAR_CONFIG.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${AVATAR_CONFIG.maxFileSize / 1024 / 1024}MB`,
    };
  }

  // Check minimum size (avoid empty/corrupt files)
  if (buffer.length < 100) {
    return {
      valid: false,
      error: 'File is too small to be a valid image',
    };
  }

  // Detect file type from magic bytes
  const fileType = await fileTypeFromBuffer(buffer);

  if (!fileType) {
    return {
      valid: false,
      error: 'Unable to determine file type. Please upload a valid image.',
    };
  }

  // Check if MIME type is allowed
  if (!AVATAR_CONFIG.allowedMimeTypes.includes(fileType.mime as AllowedMimeType)) {
    return {
      valid: false,
      error: `File type '${fileType.mime}' is not allowed. Allowed types: ${AVATAR_CONFIG.allowedMimeTypes.join(', ')}`,
    };
  }

  return {
    valid: true,
    mimeType: fileType.mime as AllowedMimeType,
  };
}

/**
 * Generate a unique, safe filename for avatar storage
 */
export function generateAvatarFilename(mimeType: AllowedMimeType): string {
  const uuid = crypto.randomUUID();
  const ext = MIME_TO_EXT[mimeType];
  return `avatar-${uuid}.${ext}`;
}

/**
 * Get the user's avatar directory path
 */
export function getUserAvatarDir(userId: string): string {
  return path.join(AVATAR_CONFIG.uploadDir, userId);
}

/**
 * Get the full file path for an avatar
 */
export function getAvatarFilePath(userId: string, filename: string): string {
  return path.join(getUserAvatarDir(userId), filename);
}

/**
 * Get relative path for database storage
 */
export function getAvatarRelativePath(userId: string, filename: string): string {
  return `avatars/${userId}/${filename}`;
}

/**
 * Ensure the avatar directory exists for a user
 */
export async function ensureAvatarDir(userId: string): Promise<void> {
  const dir = getUserAvatarDir(userId);
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save avatar buffer to disk
 * Returns the relative path for database storage
 */
export async function saveAvatar(
  userId: string,
  buffer: Buffer,
  mimeType: AllowedMimeType
): Promise<{ relativePath: string; filename: string }> {
  // Ensure directory exists
  await ensureAvatarDir(userId);

  // Generate safe filename
  const filename = generateAvatarFilename(mimeType);
  const filePath = getAvatarFilePath(userId, filename);

  // Write file to disk
  await fs.writeFile(filePath, buffer);

  return {
    relativePath: getAvatarRelativePath(userId, filename),
    filename,
  };
}

/**
 * Delete an avatar file from disk
 */
export async function deleteAvatarFile(relativePath: string): Promise<void> {
  const fullPath = path.join('/app/data', relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    // Ignore if file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Delete all avatar files for a user
 */
export async function deleteUserAvatars(userId: string): Promise<void> {
  const dir = getUserAvatarDir(userId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore errors (directory might not exist)
  }
}

/**
 * Read avatar file from disk
 * Returns null if file doesn't exist
 */
export async function readAvatarFile(relativePath: string): Promise<Buffer | null> {
  const fullPath = path.join('/app/data', relativePath);
  try {
    return await fs.readFile(fullPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Read the default avatar SVG
 */
export function readDefaultAvatar(): Buffer {
  return Buffer.from(DEFAULT_AVATAR_SVG, 'utf-8');
}

/**
 * Get MIME type from relative path
 */
export function getMimeTypeFromPath(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase().slice(1);
  const extToMime: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return extToMime[ext] || 'application/octet-stream';
}
