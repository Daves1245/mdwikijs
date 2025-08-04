import fs, {readdirSync} from 'fs';
import path from 'path';
import { SourceNode } from '@/types';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import remarkRehype from 'remark-rehype';
import rehypeToc from 'rehype-toc';
import rehypeStringify from 'rehype-stringify';
import chokidar, { FSWatcher } from 'chokidar';

export default class SourceManager {
    sources: SourceNode = {
        type: 'directory',
        name: 'root',
        children: [],
    };
    
    private watcher: FSWatcher | null = null;

    private async processMarkdown(content: string): Promise<string> {
        console.log('🟡 Processing markdown, content length:', content.length);
        const result = await unified()
            .use(remarkParse)
            .use(remarkGfm) // GitHub Flavored Markdown support for tables, strikethrough, etc.
            .use(remarkToc, { heading: 'Table of Contents' })
            .use(remarkRehype)
            .use(rehypeToc, { nav: false })
            .use(rehypeStringify)
            .process(content);
        
        console.log('🟡 Markdown processed, HTML length:', String(result).length);
        return String(result);
    }

    public async ingest(rootPath: string): Promise<void> {
        console.log('🟡 SourceManager.ingest() called with path:', rootPath);
        
        // Check if path exists
        if (!fs.existsSync(rootPath)) {
            console.error('🔴 Root path does not exist:', rootPath);
            throw new Error(`Root path does not exist: ${rootPath}`);
        }
        
        console.log('🟡 Path exists, resetting sources...');
        // reset sources before ingesting
        this.sources = {
            type: 'directory',
            name: 'root',
            children: [],
        };

        const fillSourceDFS = async (root: SourceNode, currentPath: string): Promise<SourceNode> => {
            console.log('🟡 Processing path:', currentPath, 'type:', root.type);
            
            if (root.type != 'directory') {
                console.log('🟡 Processing file:', currentPath);
                const content = fs.readFileSync(currentPath).toString();
                console.log('🟡 File content length:', content.length);
                const htmlContent = await this.processMarkdown(content);
                const filename = path.basename(currentPath, '.md');

                return {
                    type: 'file',
                    content: {
                        slug: filename,
                        title: filename.replace(/[-_]/g, ' '),
                        content,
                        htmlContent,
                    }
                };
            }

            console.log('🟡 Reading directory entries from:', currentPath);
            const entries = readdirSync(currentPath, { withFileTypes: true });
            console.log('🟡 Found', entries.length, 'entries:', entries.map(e => `${e.name} (${e.isDirectory() ? 'dir' : 'file'})`));
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    console.log('🟡 Processing directory:', entry.name);
                    root.children.push(await fillSourceDFS({
                        type: 'directory',
                        name: entry.name,
                        children: []
                    }, fullPath));
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                    console.log('🟡 Processing markdown file:', entry.name);
                    const content = fs.readFileSync(fullPath).toString();
                    console.log('🟡 File content length:', content.length);
                    const htmlContent = await this.processMarkdown(content);
                    const filename = path.basename(fullPath, '.md');
                    
                    root.children.push({
                        type: 'file',
                        content: {
                            slug: filename,
                            title: filename.replace(/[-_]/g, ' '),
                            content,
                            htmlContent,
                        }
                    });
                } else {
                    console.log('🟡 Skipping non-markdown file:', entry.name);
                }
            }
            return root;
        }

        console.log('🟡 Starting DFS traversal...');
        this.sources = await fillSourceDFS(this.sources, rootPath);
        console.log('🟡 DFS traversal completed');
    }

    public startWatching(rootPath: string, onUpdate: () => void): void {
        if (this.watcher) {
            this.watcher.close();
        }

        this.watcher = chokidar.watch(rootPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true
        });

        this.watcher
            .on('add', async (filePath) => {
                if (filePath.endsWith('.md')) {
                    console.log(`File ${filePath} has been added`);
                    await this.ingest(rootPath);
                    onUpdate();
                }
            })
            .on('change', async (filePath) => {
                if (filePath.endsWith('.md')) {
                    console.log(`File ${filePath} has been changed`);
                    await this.ingest(rootPath);
                    onUpdate();
                }
            })
            .on('unlink', async (filePath) => {
                if (filePath.endsWith('.md')) {
                    console.log(`File ${filePath} has been removed`);
                    await this.ingest(rootPath);
                    onUpdate();
                }
            });
    }

    public stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}