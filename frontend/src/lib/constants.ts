export const CATEGORY_COLORS: Record<string, string> = {
  'Video': 'bg-[#ff3b30]',     // Red
  'Audio': 'bg-[#007aff]',     // Blue
  'Images': 'bg-[#ffcc00]',    // Yellow
  'Archives': 'bg-[#4cd964]',  // Green
  'Documents': 'bg-[#ff9500]', // Orange
  'Backups': 'bg-[#af52de]',   // Purple
  'System': 'bg-[#5856d6]',    // Indigo
  'Other': 'bg-[#8e8e93]',     // Gray
};

export const STORAGE_BAR_COLORS = [
  'bg-[#ff3b30]', 
  'bg-[#007aff]', 
  'bg-[#ffcc00]',
  'bg-[#4cd964]', 
  'bg-[#ff9500]', 
  'bg-[#af52de]', 
  'bg-[#5856d6]',
  'bg-[#8e8e93]',
];

export const CATEGORY_MAP: Record<string, string> = {
  'mp4': 'Video', 'mkv': 'Video', 'mov': 'Video', 'avi': 'Video',
  'mp3': 'Audio', 'flac': 'Audio', 'wav': 'Audio', 'm4a': 'Audio',
  'jpg': 'Images', 'jpeg': 'Images', 'png': 'Images', 'gif': 'Images', 'webp': 'Images',
  'zip': 'Archives', 'rar': 'Archives', '7z': 'Archives', 'tar': 'Archives', 'gz': 'Archives',
  'pdf': 'Documents', 'doc': 'Documents', 'docx': 'Documents', 'txt': 'Documents',
  'bak': 'Backups', 'old': 'Backups',
};
