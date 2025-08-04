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
        const result = await unified()
            .use(remarkParse)
            .use(remarkGfm) // GitHub Flavored Markdown support for tables, strikethrough, etc.
            .use(remarkToc, { heading: 'Table of Contents' })
            .use(remarkRehype)
            .use(rehypeToc, { nav: false })
            .use(rehypeStringify)
            .process(content);

        return String(result);
    }

    public async ingest(rootPath: string): Promise<void> {
        // reset sources before ingesting
        this.sources = {
            type: 'directory',
            name: 'root',
            children: [],
        };

        const fillSourceDFS = async (root: SourceNode, currentPath: string): Promise<SourceNode> => {
            if (root.type != 'directory') {
                const content = fs.readFileSync(currentPath).toString();
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

            const entries = readdirSync(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    root.children.push(await fillSourceDFS({
                        type: 'directory',
                        name: entry.name,
                        children: []
                    }, fullPath));
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                    const content = fs.readFileSync(fullPath).toString();
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
                }
            }
            return root;
        }

        this.sources = await fillSourceDFS(this.sources, rootPath);
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
