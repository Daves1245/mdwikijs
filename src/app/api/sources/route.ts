import { NextResponse } from 'next/server';
import SourceManager from '@/util/SourceManager';
import { notifyClients } from '@/lib/sse';

let globalSourceManager: SourceManager | null = null;

// manages file watching
export async function GET() {
  console.log('🔵 GET /api/sources called');
  
  try {
    if (!globalSourceManager) {
      console.log('🔵 Creating new SourceManager instance');
      globalSourceManager = new SourceManager();
      const rootPath = process.env.WIKI_ROOT_PATH || './wiki';
      
      console.log('🔵 Root path:', rootPath);
      console.log('🔵 Starting ingestion...');
      
      const startTime = Date.now();
      await globalSourceManager.ingest(rootPath);
      const endTime = Date.now();
      
      console.log(`🔵 Ingestion completed in ${endTime - startTime}ms`);
      console.log('🔵 Sources structure:', JSON.stringify(globalSourceManager.sources, null, 2));

      console.log('🔵 Starting file watcher...');
      globalSourceManager.startWatching(rootPath, () => {
        console.log('🔵 File change detected, notifying clients');
        notifyClients({
          type: 'sources_updated',
          sources: globalSourceManager!.sources
        });
      });
      console.log('🔵 File watcher started');
    } else {
      console.log('🔵 Using existing SourceManager instance');
    }

    console.log('🔵 Returning sources response');
    return NextResponse.json({
      success: true,
      sources: globalSourceManager.sources
    });
  } catch (error) {
    console.error('🔴 Error fetching sources:', error);
    console.error('🔴 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
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
