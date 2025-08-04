export interface MarkdownContent {
  slug: string;
  title: string;
  content: string;
  htmlContent: string;
};

export type SourceNode =
  {type: 'directory'; name: string; children: Array<SourceNode>} |
  {type: 'file'; content: MarkdownContent};
