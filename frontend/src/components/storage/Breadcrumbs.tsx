import { Fragment } from 'react';

interface BreadcrumbsProps {
  path: string;
  onPathChange: (path: string) => void;
}

export function Breadcrumbs({ path, onPathChange }: BreadcrumbsProps) {
  const parts = path.split('/').filter(Boolean);
  const trail = [{ name: 'Root', path: '/data' }];

  let current = '/data';
  parts.forEach(p => {
    if (p === 'data') return;
    current += '/' + p;
    trail.push({ name: p, path: current });
  });

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-400 mb-3">
      {trail.map((t, i) => (
        <Fragment key={t.path}>
          {i > 0 && <span className="opacity-40">/</span>}
          <button
            onClick={() => onPathChange(t.path)}
            className={`hover:text-gray-900 px-1 py-0.5 rounded transition-colors ${i === trail.length - 1 ? 'text-gray-800 font-semibold' : ''
              }`}
          >
            {t.name}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
