"use client";

import React, { useEffect, useState } from 'react';
import { SourceNode, MarkdownContent } from '@/types';
import dynamic from 'next/dynamic';

const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });
const TableOfContents = dynamic(() => import('@/components/TableOfContents'), { ssr: false });

interface MarkdownRendererProps {
  content: MarkdownContent;
}

// markdown wrapper
function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div>
      <TableOfContents htmlContent={content.htmlContent} />
      <article className="prose prose-lg prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-6 text-gray-100">{content.title}</h1>
        <div
          dangerouslySetInnerHTML={{ __html: content.htmlContent }}
          className="markdown-content text-gray-200 leading-relaxed"
        />
      </article>
    </div>
  );
}

function getFirstMarkdownFile(node: SourceNode): MarkdownContent | null {
  if (node.type === 'file') {
    return node.content;
  }

  for (const child of node.children) {
    const result = getFirstMarkdownFile(child);
    if (result) return result;
  }

  return null;
}

export default function Home() {
  const [sources, setSources] = useState<SourceNode | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<MarkdownContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch('/api/sources');
        const data = await response.json();

        if (data.success) {
          setSources(data.sources);
          const firstFile = getFirstMarkdownFile(data.sources);
          if (firstFile) {
            setCurrentFile(firstFile.slug);
            setCurrentContent(firstFile);
          }
        } else {
          setError(data.message || 'Failed to fetch sources');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSources();

    // server events for watch updates
    const eventSource = new EventSource('/api/sources/watch');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'sources_updated') {
        console.log('Sources updated, refreshing...');
        setSources(data.sources);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleFileSelect = (slug: string, content: MarkdownContent) => {
    setCurrentFile(slug);
    setCurrentContent(content);
  };

  if (loading) return <div className="p-8">Loading sources...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="flex h-screen bg-gray-900">
      {sources && (
        <Sidebar
          sources={sources}
          currentFile={currentFile}
          onFileSelect={handleFileSelect}
        />
      )}
      <div className="flex-1 overflow-auto bg-gray-800">
        <div className="container mx-auto px-8 py-8">
          {currentContent ? (
            <MarkdownRenderer content={currentContent} />
          ) : (
            <div className="text-gray-400">Select a markdown file from the sidebar</div>
          )}
        </div>
      </div>
    </div>
  );
}
