import React, { useState } from 'react';
import { SourceNode, MarkdownContent } from '@/types';

interface SidebarProps {
  sources: SourceNode;
  currentFile: string | null;
  onFileSelect: (slug: string, content: MarkdownContent) => void;
}

interface SidebarNodeProps {
  node: SourceNode;
  level: number;
  currentFile: string | null;
  onFileSelect: (slug: string, content: MarkdownContent) => void;
}

function SidebarNode({ node, level, currentFile, onFileSelect }: SidebarNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const indent = level * 16;

  if (node.type === 'directory') {
    return (
      <div className="mb-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left py-1 px-2 hover:bg-gray-700 rounded transition-colors flex items-center"
          style={{ paddingLeft: `${indent}px` }}
        >
          <span className="mr-2 text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="font-medium text-gray-200">
            {node.name}
          </span>
        </button>
        {isExpanded && (
          <div>
            {node.children.map((child, index) => (
              <SidebarNode
                key={index}
                node={child}
                level={level + 1}
                currentFile={currentFile}
                onFileSelect={onFileSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = currentFile === node.content.slug;

  return (
    <button
      onClick={() => onFileSelect(node.content.slug, node.content)}
      className={`w-full text-left py-2 px-2 rounded-md transition-colors flex items-center ${
        isSelected
          ? 'bg-blue-600 text-blue-100 border-l-4 border-blue-400 ml-1'
          : 'hover:bg-gray-700 text-gray-300'
      }`}
      style={{ paddingLeft: `${indent}px` }}
    >
      <span className="mr-2 text-gray-400">•</span>
      <span>{node.content.title}</span>
    </button>
  );
}

export default function Sidebar({ sources, currentFile, onFileSelect }: SidebarProps) {
  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 h-screen overflow-y-auto">
      <div className="p-4">
        <SidebarNode
          node={sources}
          level={0}
          currentFile={currentFile}
          onFileSelect={onFileSelect}
        />
      </div>
    </div>
  );
}
