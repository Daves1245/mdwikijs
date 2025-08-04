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
        console.log('Processing markdown, content length:', content.length);
        const result = await unified()
            .use(remarkParse)
            .use(remarkGfm) // GitHub Flavored Markdown support for tables, strikethrough, etc.
            .use(remarkToc, { heading: 'Table of Contents' })
            .use(remarkRehype)
            .use(rehypeToc, { nav: false })
            .use(rehypeStringify)
            .process(content);

        console.log('Markdown processed, HTML length:', String(result).length);
        return String(result);
    }

    public async ingest(rootPath: string): Promise<void> {
        console.log('SourceManager.ingest() called with path:', rootPath);

        if (!fs.existsSync(rootPath)) {
            console.error('Root path does not exist:', rootPath);
            throw new Error(`Root path does not exist: ${rootPath}`);
        }

        console.log('Path exists, resetting sources...');
        // reset sources before ingesting and clear any references
        this.sources = {
            type: 'directory',
            name: 'root',
            children: [],
        };

        // Track visited paths to prevent infinite recursion
        const visitedPaths = new Set<string>();

        const fillSourceDFS = async (root: SourceNode, currentPath: string, depth: number = 0): Promise<SourceNode> => {
            // Prevent infinite recursion and excessive depth
            if (depth > 10) {
                console.log('Max depth reached, stopping recursion at:', currentPath);
                return root;
            }

            // Prevent circular references
            const normalizedPath = path.resolve(currentPath);
            if (visitedPaths.has(normalizedPath)) {
                console.log('Circular reference detected, skipping:', currentPath);
                return root;
            }
            visitedPaths.add(normalizedPath);

            console.log('Processing path:', currentPath, 'type:', root.type, 'depth:', depth);

            if (root.type != 'directory') {
                console.log('Processing file:', currentPath);
                try {
                    const content = fs.readFileSync(currentPath, 'utf8');
                    console.log('🟡 File content length:', content.length);

                    // Limit file size to prevent memory issues
                    if (content.length > 10000000) { // 10MB limit
                        console.log('File too large, skipping markdown processing:', currentPath);
                        const filename = path.basename(currentPath, '.md');
                        return {
                            type: 'file',
                            content: {
                                slug: filename,
                                title: filename.replace(/[-_]/g, ' '),
                                content: 'File too large to process',
                                htmlContent: '<p>File too large to process</p>',
                            }
                        };
                    }

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
                } catch (error) {
                    console.error('🔴 Error processing file:', currentPath, error);
                    const filename = path.basename(currentPath, '.md');
                    return {
                        type: 'file',
                        content: {
                            slug: filename,
                            title: filename.replace(/[-_]/g, ' '),
                            content: 'Error reading file',
                            htmlContent: '<p>Error reading file</p>',
                        }
                    };
                } finally {
                    visitedPaths.delete(normalizedPath);
                }
            }

            try {
                console.log('Reading directory entries from:', currentPath);
                const entries = readdirSync(currentPath, { withFileTypes: true });
                console.log('Found', entries.length, 'entries');

                // Limit number of entries to prevent memory explosion
                const limitedEntries = entries.slice(0, 100); // Max 100 entries per directory
                if (entries.length > 100) {
                    console.log('🔴 Too many entries, limiting to first 100');
                }

                for (const entry of limitedEntries) {
                    const fullPath = path.join(currentPath, entry.name);

                    // Skip hidden files and common non-content directories
                    if (entry.name.startsWith('.') ||
                        entry.name === 'node_modules' ||
                        entry.name === '.git' ||
                        entry.name === '.next') {
                        console.log('Skipping system/hidden file:', entry.name);
                        continue;
                    }

                    if (entry.isDirectory()) {
                        console.log('Processing directory:', entry.name);
                        const childNode = await fillSourceDFS({
                            type: 'directory',
                            name: entry.name,
                            children: []
                        }, fullPath, depth + 1);
                        root.children.push(childNode);
                    } else if (entry.isFile() && entry.name.endsWith('.md')) {
                        console.log('Processing markdown file:', entry.name);
                        const childNode = await fillSourceDFS({
                            type: 'file',
                            content: {
                                slug: '',
                                title: '',
                                content: '',
                                htmlContent: '',
                            }
                        }, fullPath, depth + 1);
                        root.children.push(childNode);
                    } else {
                        console.log('Skipping non-markdown file:', entry.name);
                    }
                }
            } catch (error) {
                console.error('Error reading directory:', currentPath, error);
            } finally {
                visitedPaths.delete(normalizedPath);
            }

            return root;
        }

        console.log('Starting DFS traversal...');
        this.sources = await fillSourceDFS(this.sources, rootPath);
        console.log('DFS traversal completed');

        // Force garbage collection hint
        if (global.gc) {
            global.gc();
        }
    }

    public startWatching(rootPath: string, onUpdate: () => void): void {
        if (this.watcher) {
            console.log('Closing existing file watcher');
            this.watcher.close();
            this.watcher = null;
        }

        console.log('Starting new file watcher for:', rootPath);
        this.watcher = chokidar.watch(rootPath, {
            ignored: [
                /(^|[\/\\])\../, // ignore dotfiles
                /node_modules/,
                /\.git/,
                /\.next/
            ],
            persistent: true,
            ignoreInitial: true, // Don't trigger events for existing files
            depth: 10 // Limit depth to prevent infinite recursion
        });

        // Debounce file changes to prevent rapid successive updates
        let debounceTimer: NodeJS.Timeout | null = null;
        const debouncedUpdate = () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(async () => {
                console.log('Debounced file change, triggering update');
                try {
                    await this.ingest(rootPath);
                    onUpdate();
                } catch (error) {
                    console.error('Error during file watch update:', error);
                }
            }, 500); // 500ms debounce
        };

        this.watcher
            .on('add', (filePath) => {
                if (filePath.endsWith('.md')) {
                    console.log(`File added: ${filePath}`);
                    debouncedUpdate();
                }
            })
            .on('change', (filePath) => {
                if (filePath.endsWith('.md')) {
                    console.log(`File changed: ${filePath}`);
                    debouncedUpdate();
                }
            })
            .on('unlink', (filePath) => {
                if (filePath.endsWith('.md')) {
                    console.log(`File removed: ${filePath}`);
                    debouncedUpdate();
                }
            })
            .on('error', (error) => {
                console.error('File watcher error:', error);
            });
    }

    public stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
