import { v2 as cloud } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { PassThrough } from 'node:stream';
import { AppError } from '@/utils/AppError.js';
import { env } from '@/config/env.js';

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

function ensureConfigured(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError('File upload service is not configured', 503);
  }
  cloud.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

function streamUpload(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloud.uploader.upload_stream(options, (error, result) => {
      if (!result) {
        reject(new Error(error?.message ?? 'Cloudinary upload returned no result'));
        return;
      }
      resolve(result);
    });
    const passthrough = new PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });
}

export async function uploadFile(
  buffer: Buffer,
  options: {
    folder: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    publicId?: string;
  },
): Promise<UploadResult> {
  ensureConfigured();
  const result = await streamUpload(buffer, {
    folder: options.folder,
    resource_type: options.resourceType ?? 'image',
    ...(options.publicId !== undefined && { public_id: options.publicId }),
    overwrite: true,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function deleteFile(publicId: string): Promise<void> {
  ensureConfigured();
  await cloud.uploader.destroy(publicId);
}
