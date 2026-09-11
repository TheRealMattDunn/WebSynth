import type { ControlPage } from '@/core/controls/types';
import styles from './Chrome.module.css';

interface PageTabsProps {
  pages: readonly ControlPage[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function PageTabs({ pages, activeIndex, onSelect }: PageTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Control pages">
      {pages.map((page, index) => (
        <button
          key={page.id}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={index === activeIndex}
          onClick={() => {
            onSelect(index);
          }}
        >
          {page.label}
        </button>
      ))}
    </div>
  );
}
