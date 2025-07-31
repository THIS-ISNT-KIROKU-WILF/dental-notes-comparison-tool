import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { evaluateDentalNotes, rankEvaluations } from '@/lib/openai';
import { EvaluationRequest, Evaluation, EvaluationResults, BatchData } from '@/types';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
  try {
    const body: EvaluationRequest = await request.json();
    console.log('Received evaluation request:', { hasBatchId: !!body.batchId, hasBatchData: !!body.batchData });

    // Handle batch evaluation with chunked processing
    if (body.batchId && body.batchData) {
      console.log('Processing batch evaluation for batchId:', body.batchId);
      try {
        // For large batches, process in chunks to avoid timeout
        const totalFiles = Object.values(body.batchData.structure).reduce((sum, group) => {
          const typedGroup = group as { transcript: { content: string } | null; notes: Array<{ name: string; content: string }> };
          return sum + typedGroup.notes.length;
        }, 0);
        console.log(`Total files to evaluate: ${totalFiles}`);
        
        if (totalFiles > 100) {
          // For very large batches, process only the first batch and return partial results
          console.log(`Very large batch detected (${totalFiles} files). Processing first 50 files only.`);
          const partialResults = await evaluatePartialBatch(body.batchData, 50);
          return NextResponse.json({
            success: true,
            evaluations: partialResults,
            isPartial: true,
            totalFiles,
            processedFiles: partialResults.length,
            message: `Processed first ${partialResults.length} of ${totalFiles} files due to size limits. Use individual upload for complete analysis.`
          });
        } else if (totalFiles > 5) {
          // For medium batches, process in smaller chunks
          const batchResults = await evaluateBatchInChunks(body.batchData, 5); // Process 5 files at a time
          return NextResponse.json({
            success: true,
            evaluations: batchResults
          });
        } else {
          // For smaller batches, use the original method
          const batchResults = await evaluateBatchInMemory(body.batchData);
          return NextResponse.json({
            success: true,
            evaluations: batchResults
          });
        }
      } catch (error) {
        console.error('Batch evaluation failed:', error);
        return NextResponse.json(
          { error: 'Batch evaluation failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
          { status: 500 }
        );
      }
    }

    // Handle individual evaluation
    const { transcriptText, noteText, noteFileName, transcriptName } = body;

    // Validation for individual requests
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
      timestamp: new Date(),
      noteContent: noteText,
      transcriptContent: transcriptText
    };

    return NextResponse.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to evaluate notes' },
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

// Partial batch evaluation for very large batches - processes only first N files
async function evaluatePartialBatch(batchData: BatchData, maxFiles: number = 10) {
  try {
    console.log(`Starting partial batch evaluation (max ${maxFiles} files)`);
    const allEvaluations: Evaluation[] = [];
    let filesProcessed = 0;

    // Process only the first few transcript groups
    for (const [transcriptName, transcriptGroup] of Object.entries(batchData.structure)) {
      if (filesProcessed >= maxFiles) break;
      
      const group = transcriptGroup as { transcript: { content: string } | null; notes: Array<{ name: string; content: string }> };
      
      if (!group.transcript) {
        console.warn(`No transcript found for ${transcriptName}, skipping...`);
        continue;
      }

      const transcriptContent = group.transcript.content;
      console.log(`Processing ${transcriptName} with ${group.notes.length} note files`);
      
      // Process note files for this transcript (but respect the limit)
      for (const noteFile of group.notes) {
        if (filesProcessed >= maxFiles) break;
        
        try {
          console.log(`Evaluating ${noteFile.name} for ${transcriptName} (${filesProcessed + 1}/${maxFiles})`);
          const results = await evaluateDentalNotes({
            transcript: transcriptContent,
            notes: noteFile.content,
            noteFileName: noteFile.name
          });
          
          const evaluation: Evaluation = {
            id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transcriptName,
            noteFileName: noteFile.name,
            results,
            timestamp: new Date(),
            noteContent: noteFile.content,
            transcriptContent: transcriptContent
          };
          
          allEvaluations.push(evaluation);
          filesProcessed++;
          console.log(`Completed evaluation ${filesProcessed}/${maxFiles}`);
          
          // Minimal delay for rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error evaluating ${noteFile.name} for ${transcriptName}:`, error);
          continue;
        }
      }
    }

    // Apply basic ranking to processed evaluations
    const evaluationsByTranscript = new Map<string, Evaluation[]>();
    allEvaluations.forEach(evaluation => {
      const key = evaluation.transcriptName;
      if (!evaluationsByTranscript.has(key)) {
        evaluationsByTranscript.set(key, []);
      }
      evaluationsByTranscript.get(key)!.push(evaluation);
    });

    // Apply rankings within each group
    evaluationsByTranscript.forEach((evaluations) => {
      const results = evaluations.map(e => e.results);
      const rankedResults = rankEvaluations(results);
      
      evaluations.forEach((evaluation, index) => {
        evaluation.results = rankedResults[index];
      });
    });

    console.log(`Partial batch evaluation completed: ${allEvaluations.length} evaluations`);
    return allEvaluations;
  } catch (error) {
    console.error('Partial batch evaluation error:', error);
    throw new Error('Failed to evaluate partial batch: ' + 
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

// Chunked batch evaluation for large batches to avoid timeout
async function evaluateBatchInChunks(batchData: BatchData, chunkSize: number = 5) {
  try {
    console.log('Starting chunked batch evaluation');
    const allEvaluations: Evaluation[] = [];
    const allTasks: Array<{ transcriptName: string; transcriptContent: string; noteFile: { name: string; content: string } }> = [];

    // Collect all evaluation tasks
    for (const [transcriptName, transcriptGroup] of Object.entries(batchData.structure)) {
      const group = transcriptGroup as { transcript: { content: string } | null; notes: Array<{ name: string; content: string }> };
      
      if (!group.transcript) {
        console.warn(`No transcript found for ${transcriptName}, skipping...`);
        continue;
      }

      const transcriptContent = group.transcript.content;
      
      // Add each note evaluation task
      for (const noteFile of group.notes) {
        allTasks.push({
          transcriptName,
          transcriptContent,
          noteFile
        });
      }
    }

    console.log(`Created ${allTasks.length} evaluation tasks, processing in chunks of ${chunkSize}`);

    // Process tasks in chunks
    for (let i = 0; i < allTasks.length; i += chunkSize) {
      const chunk = allTasks.slice(i, i + chunkSize);
      console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(allTasks.length / chunkSize)}`);
      
      // Process chunk with reduced delay
      for (const task of chunk) {
        try {
          console.log(`Evaluating ${task.noteFile.name} for ${task.transcriptName}...`);
          const results = await evaluateDentalNotes({
            transcript: task.transcriptContent,
            notes: task.noteFile.content,
            noteFileName: task.noteFile.name
          });
          
          const evaluation: Evaluation = {
            id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transcriptName: task.transcriptName,
            noteFileName: task.noteFile.name,
            results,
            timestamp: new Date(),
            noteContent: task.noteFile.content,
            transcriptContent: task.transcriptContent
          };
          
          allEvaluations.push(evaluation);
          console.log(`Completed evaluation for ${task.noteFile.name}, total: ${allEvaluations.length}/${allTasks.length}`);
          
          // Minimal delay for faster processing while respecting rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error evaluating ${task.noteFile.name} for ${task.transcriptName}:`, error);
          continue;
        }
      }
    }

    // Rank evaluations within each transcript group
    const evaluationsByTranscript = new Map<string, Evaluation[]>();
    allEvaluations.forEach(evaluation => {
      const key = evaluation.transcriptName;
      if (!evaluationsByTranscript.has(key)) {
        evaluationsByTranscript.set(key, []);
      }
      evaluationsByTranscript.get(key)!.push(evaluation);
    });

    // Apply rankings within each group
    evaluationsByTranscript.forEach((evaluations) => {
      const results = evaluations.map(e => e.results);
      const rankedResults = rankEvaluations(results);
      
      evaluations.forEach((evaluation, index) => {
        evaluation.results = rankedResults[index];
      });
    });

    console.log(`Chunked batch evaluation completed with ${allEvaluations.length} total evaluations`);
    return allEvaluations;
  } catch (error) {
    console.error('Chunked batch evaluation error:', error);
    throw new Error('Failed to evaluate batch in chunks: ' + 
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

// New function for in-memory batch evaluation
async function evaluateBatchInMemory(batchData: BatchData) {
  try {
    console.log('Starting batch evaluation with data:', JSON.stringify(batchData, null, 2));
    const allEvaluations: Evaluation[] = [];

    // Process each transcript group from the in-memory structure
    for (const [transcriptName, transcriptGroup] of Object.entries(batchData.structure)) {
      console.log(`Processing transcript: ${transcriptName}`);
      const group = transcriptGroup as { transcript: { content: string } | null; notes: Array<{ name: string; content: string }> };
      
      if (!group.transcript) {
        console.warn(`No transcript found for ${transcriptName}, skipping...`);
        continue;
      }

      const transcriptContent = group.transcript.content;
      console.log(`Found transcript content (${transcriptContent.length} chars) and ${group.notes.length} note files`);
      
      // Evaluate each note file against the transcript
      for (const noteFile of group.notes) {
        try {
          console.log(`Evaluating ${noteFile.name} for ${transcriptName}...`);
          const results = await evaluateDentalNotes({
            transcript: transcriptContent,
            notes: noteFile.content,
            noteFileName: noteFile.name
          });
          
          const evaluation: Evaluation = {
            id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transcriptName,
            noteFileName: noteFile.name,
            results,
            timestamp: new Date(),
            noteContent: noteFile.content,
            transcriptContent: transcriptContent
          };
          
          allEvaluations.push(evaluation);
          console.log(`Completed evaluation for ${noteFile.name}, total evaluations: ${allEvaluations.length}`);
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error evaluating ${noteFile.name} for ${transcriptName}:`, error);
          continue;
        }
      }
    }

    // Rank evaluations within each transcript group
    const evaluationsByTranscript = new Map<string, Evaluation[]>();
    allEvaluations.forEach(evaluation => {
      const key = evaluation.transcriptName;
      if (!evaluationsByTranscript.has(key)) {
        evaluationsByTranscript.set(key, []);
      }
      evaluationsByTranscript.get(key)!.push(evaluation);
    });

    // Apply rankings within each group
    evaluationsByTranscript.forEach((evaluations) => {
      const results = evaluations.map(e => e.results);
      const rankedResults = rankEvaluations(results);
      
      // Update the evaluations with ranked results
      evaluations.forEach((evaluation, index) => {
        evaluation.results = rankedResults[index];
      });
    });

    console.log(`Batch evaluation completed with ${allEvaluations.length} total evaluations`);
    return allEvaluations;
  } catch (error) {
    console.error('Batch evaluation error:', error);
    throw new Error('Failed to evaluate batch: ' + 
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}