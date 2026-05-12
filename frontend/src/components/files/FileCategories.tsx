import type { Category } from '../../types';
import { formatBytes } from '../../lib/utils';
import { CATEGORY_COLORS } from '../../lib/constants';

interface FileCategoriesProps {
  categories: Category[];
  totalSize: number;
  selectedCategory: string | null;
  onCategorySelect: (cat: string | null) => void;
}

export function FileCategories({ categories, totalSize, selectedCategory, onCategorySelect }: FileCategoriesProps) {
  if (!categories || categories.length === 0) return null;

  const sorted = [...categories].sort((a, b) => b.sizeBytes - a.sizeBytes);

  const categoryColors = CATEGORY_COLORS;

  return (
    <div className="space-y-4">
      {sorted.map(cat => {
        const percentage = (cat.sizeBytes / totalSize) * 100;
        const isSelected = selectedCategory === cat.category;

        return (
          <button
            key={cat.category}
            onClick={() => onCategorySelect(isSelected ? null : cat.category)}
            className={`w-full text-left space-y-1.5 p-2 rounded-xl transition-all group ${isSelected ? 'bg-black/5 ring-1 ring-black/5' : 'hover:bg-black/2'
              }`}
          >
            <div className="flex justify-between text-xs font-medium">
              <span className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${categoryColors[cat.category] || 'bg-gray-400'} ${isSelected ? 'scale-125 shadow-sm' : 'group-hover:scale-110'} transition-transform`} />
                <span className={isSelected ? 'text-gray-900 font-bold' : 'text-gray-600'}>{cat.category}</span>
              </span>
              <span className="text-muted-foreground">{formatBytes(cat.sizeBytes)} ({percentage.toFixed(1)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
              <div
                className={`h-full ${categoryColors[cat.category] || 'bg-gray-400'} transition-all duration-1000 ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
