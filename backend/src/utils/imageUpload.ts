import { supabase } from '../supabaseClient';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload image to Supabase storage
 */
export async function uploadImage(
  file: Buffer,
  filename: string,
  folder: 'favicons' | 'logos' | 'og-images' | 'hero-images' | 'social' = 'logos'
): Promise<UploadResult> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = filename.split('.').pop() || 'jpg';
  const uniqueFilename = `${folder}/${timestamp}-${randomStr}.${extension}`;

  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('site-assets')
    .upload(uniqueFilename, file, {
      contentType: getContentType(extension),
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(uniqueFilename);

  return {
    url: urlData.publicUrl,
    path: uniqueFilename,
  };
}

/**
 * Validate image file
 */
export function validateImageFile(
  buffer: Buffer,
  mimetype: string,
  originalName: string
): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_TYPES.includes(mimetype)) {
    return {
      valid: false,
      error: `File type ${mimetype} not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
    };
  }

  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file extension
  const extension = originalName.split('.').pop()?.toLowerCase();
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  if (!extension || !validExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension .${extension} not allowed. Allowed extensions: ${validExtensions.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Delete image from Supabase storage
 */
export async function deleteImage(path: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase.storage
    .from('site-assets')
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * List all images in storage bucket
 */
export async function listImages(folder?: string): Promise<string[]> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.storage
    .from('site-assets')
    .list(folder || '', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    throw new Error(`Failed to list images: ${error.message}`);
  }

  // Return full paths for files
  return (data || []).map(file => {
    // If folder is specified, files are already in that folder
    // If no folder, file.name is the full path
    return folder ? `${folder}/${file.name}` : file.name;
  });
}

/**
 * Get content type from file extension
 */
function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };

  return contentTypes[extension.toLowerCase()] || 'image/jpeg';
}

