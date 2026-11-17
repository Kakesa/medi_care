import { createHash } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function signature(folder: string, timestamp: string, secret: string) {
  return createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
}

export async function uploadImage(dataUrl: string, folder: string): Promise<string> {
  if (dataUrl.startsWith('https://')) {
    if (dataUrl.length > 2048) throw new ApiError(400, 'Image invalide', 'INVALID_IMAGE');
    return dataUrl;
  }
  if (!dataUrl.startsWith('data:image/')) {
    throw new ApiError(400, 'Image invalide', 'INVALID_IMAGE');
  }
  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new ApiError(503, 'Le stockage des images n’est pas configuré', 'IMAGE_STORAGE_UNAVAILABLE');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = new FormData();
  body.append('file', dataUrl);
  body.append('folder', folder);
  body.append('timestamp', timestamp);
  body.append('api_key', env.CLOUDINARY_API_KEY);
  body.append('signature', signature(folder, timestamp, env.CLOUDINARY_API_SECRET));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body,
  });
  const payload = await response.json() as { secure_url?: string };
  if (!response.ok || !payload.secure_url) {
    throw new ApiError(502, 'Envoi de l’image impossible', 'IMAGE_UPLOAD_FAILED');
  }
  return payload.secure_url;
}
