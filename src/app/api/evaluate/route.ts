import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { evaluateDentalNotes, rankEvaluations } from '@/lib/openai';
import { EvaluationRequest, Evaluation, EvaluationResults } from '@/types';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
  try {
    const body: EvaluationRequest = await request.json();
    const { transcriptText, noteText, noteFileName, transcriptName } = body;

    // Validation
    if (!transcriptText || !noteText || !noteFileName || !transcriptName) {
      return NextResponse.json(
        { error: 'Missing required fields: transcriptText, noteText, noteFileName, transcriptName' },
        { status: 400 }
      );
    }

    // Evaluate the notes using OpenAI
    const results = await evaluateDentalNotes({
      transcript: transcriptText,
      notes: noteText,
      noteFileName
    });

    // Create evaluation object
    const evaluation: Evaluation = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transcriptName,
      noteFileName,
      results,
      timestamp: new Date()
    };

    return NextResponse.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate notes' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const batchId = searchParams.get('batchId');

    if (!sessionId && !batchId) {
      return NextResponse.json(
        { error: 'Either sessionId or batchId is required' },
        { status: 400 }
      );
    }

    if (sessionId) {
      // Handle individual session evaluation
      return await evaluateSession(sessionId);
    } else if (batchId) {
      // Handle batch evaluation
      return await evaluateBatch(batchId);
    }

  } catch (error) {
    console.error('Evaluation retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve evaluations' },
      { status: 500 }
    );
  }
}

async function evaluateSession(sessionId: string) {
  try {
    const sessionDir = join(UPLOAD_DIR, sessionId);
    
    // Read transcript file
    const transcriptPath = await findTranscriptFile(sessionDir);
    const transcriptContent = await readFile(transcriptPath, 'utf-8');
    
    // Read all note files
    const noteFiles = await findNoteFiles(sessionDir);
    const evaluations: Evaluation[] = [];
    
    for (const noteFile of noteFiles) {
      const noteContent = await readFile(noteFile.path, 'utf-8');
      
      const results = await evaluateDentalNotes({
        transcript: transcriptContent,
        notes: noteContent,
        noteFileName: noteFile.name
      });
      
      evaluations.push({
        id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        transcriptName: sessionId,
        noteFileName: noteFile.name,
        results,
        timestamp: new Date()
      });
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      sessionId,
      evaluations
    });

  } catch (error) {
    console.error('Session evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate session' },
      { status: 500 }
    );
  }
}

async function evaluateBatch(batchId: string) {
  try {
    const batchDir = join(UPLOAD_DIR, batchId);

    
    // Get all transcript directories
    const entries = await readdir(batchDir);
    const transcriptDirs = [];
    
    for (const entry of entries) {
      const entryPath = join(batchDir, entry);
      const entryStat = await stat(entryPath);
      if (entryStat.isDirectory()) {
        transcriptDirs.push(entry);
      }
    }
    
    const allEvaluations: Evaluation[] = [];
    
    // Process each transcript directory
    for (const transcriptDir of transcriptDirs) {
      try {
        const transcriptDirPath = join(batchDir, transcriptDir);
        
        // Read transcript file
        const transcriptPath = await findTranscriptFile(transcriptDirPath);
        const transcriptContent = await readFile(transcriptPath, 'utf-8');
        
        // Read all note files
        const noteFiles = await findNoteFiles(transcriptDirPath);
        
        // Evaluate each note file for this transcript
        for (const noteFile of noteFiles) {
          const noteContent = await readFile(noteFile.path, 'utf-8');
          
          const results = await evaluateDentalNotes({
            transcript: transcriptContent,
            notes: noteContent,
            noteFileName: noteFile.name
          });
          
          allEvaluations.push({
            id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transcriptName: transcriptDir,
            noteFileName: noteFile.name,
            results,
            timestamp: new Date()
          });
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`Completed evaluation for ${transcriptDir}`);
        
      } catch (error) {
        console.error(`Failed to evaluate transcript directory ${transcriptDir}:`, error);
        // Continue with other directories
      }
    }

    // Rank evaluations within each transcript group
    const evaluationsByTranscript = allEvaluations.reduce((acc, evaluation) => {
      if (!acc[evaluation.transcriptName]) {
        acc[evaluation.transcriptName] = [];
      }
      acc[evaluation.transcriptName].push(evaluation.results);
      return acc;
    }, {} as { [transcriptName: string]: EvaluationResults[] });

    // Apply rankings within each group
    Object.keys(evaluationsByTranscript).forEach(transcriptName => {
      const rankedResults = rankEvaluations(evaluationsByTranscript[transcriptName]);
      const evaluationsForTranscript = allEvaluations.filter(e => e.transcriptName === transcriptName);
      
      rankedResults.forEach((result, index) => {
        evaluationsForTranscript[index].results = result;
      });
    });

    return NextResponse.json({
      success: true,
      batchId,
      evaluations: allEvaluations,
      summary: {
        transcriptCount: transcriptDirs.length,
        totalEvaluations: allEvaluations.length,
        completedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate batch' },
      { status: 500 }
    );
  }
}

// Helper functions
async function findTranscriptFile(sessionDir: string): Promise<string> {
  const files = await readdir(sessionDir);
  
  for (const file of files) {
    if (file.toLowerCase().includes('transcript')) {
      return join(sessionDir, file);
    }
  }
  
  throw new Error('No transcript file found');
}

async function findNoteFiles(sessionDir: string): Promise<Array<{ name: string; path: string }>> {
  const files = await readdir(sessionDir);
  
  return files
    .filter(file => !file.toLowerCase().includes('transcript'))
    .filter(file => file.endsWith('.txt') || file.endsWith('.md'))
    .map(file => ({
      name: file,
      path: join(sessionDir, file)
    }));
}