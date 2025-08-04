"use client";
import React, { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  htmlContent: string;
}

export default function TableOfContents({ htmlContent }: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  useEffect(() => {
    // only on client
    if (typeof window === 'undefined') return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

    const items: TocItem[] = Array.from(headings).map((heading, index) => ({
      id: heading.id || `heading-${index}`,
      text: heading.textContent || '',
      level: parseInt(heading.tagName.charAt(1))
    }));

    setTocItems(items);
  }, [htmlContent]);

  if (tocItems.length === 0) return null;

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg mb-6 border border-gray-600">
      <h3 className="text-lg font-semibold mb-3 text-gray-100">Table of Contents</h3>
      <nav className="space-y-1">
        {tocItems.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToHeading(item.id)}
            className={`block text-left w-full py-1 px-2 text-sm hover:bg-gray-600 rounded transition-colors ${
              item.level === 1 ? 'font-semibold text-gray-100' :
              item.level === 2 ? 'pl-4 text-gray-200' :
              item.level === 3 ? 'pl-6 text-gray-300' :
              'pl-8 text-gray-400'
            }`}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
