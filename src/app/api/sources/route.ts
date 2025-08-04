import { NextResponse } from 'next/server';
import SourceManager from '@/util/SourceManager';
import { notifyClients } from '@/lib/sse';

let globalSourceManager: SourceManager | null = null;

// manages file watching
export async function GET() {
  try {
    if (!globalSourceManager) {
      globalSourceManager = new SourceManager();
      const rootPath = process.env.WIKI_ROOT_PATH || './wiki';

      await globalSourceManager.ingest(rootPath);

      globalSourceManager.startWatching(rootPath, () => {
        notifyClients({
          type: 'sources_updated',
          sources: globalSourceManager!.sources
        });
      });
    }

    return NextResponse.json({
      success: true,
      sources: globalSourceManager.sources
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sources',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
