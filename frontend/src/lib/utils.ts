import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import type { FolderSnapshot } from "../types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFoldersAtDepth(folders: FolderSnapshot[], parentPath: string) {
  return folders.filter(f => {
    if (f.path === parentPath) return false;
    if (!f.path.startsWith(parentPath === '/' ? '/' : parentPath + '/')) return false;

    const relativePath = parentPath === '/' ? f.path.substring(1) : f.path.substring(parentPath.length + 1);
    const parts = relativePath.split('/').filter(Boolean);
    return parts.length === 1;
  }).sort((a, b) => b.sizeBytes - a.sizeBytes);
}
