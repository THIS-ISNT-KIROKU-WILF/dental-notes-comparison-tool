import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOWED_TYPES = [
  'text/plain',
  'application/pdf', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    console.log('Individual upload API called');
    const formData = await request.formData();
    
    console.log('FormData received, parsing files...');
    const transcript = formData.get('transcript') as File;
    const notes = formData.getAll('notes') as File[];

    console.log('Files parsed:', {
      transcript: transcript ? transcript.name : 'null',
      notesCount: notes.length,
      noteNames: notes.map(n => n.name)
    });

    // Validation
    if (!transcript) {
      console.error('No transcript file found in FormData');
      return NextResponse.json(
        { error: 'Transcript file is required' },
        { status: 400 }
      );
    }

    if (notes.length === 0) {
      console.error('No note files found in FormData');
      return NextResponse.json(
        { error: 'At least one note file is required' },
        { status: 400 }
      );
    }

    // Validate file types and sizes
    const allFiles = [transcript, ...notes];
    for (const file of allFiles) {
      console.log(`Validating file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.txt')) {
        console.error(`Invalid file type: ${file.type} for file ${file.name}`);
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: .txt, .pdf, .docx, .md` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        console.error(`File too large: ${file.name}, size: ${file.size}`);
        return NextResponse.json(
          { error: `File ${file.name} is too large. Max size: 10MB` },
          { status: 400 }
        );
      }
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Create session directory
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionDir = join(UPLOAD_DIR, sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Save files
    console.log('Starting file save process...');
    const savedFiles = {
      transcript: '',
      notes: [] as string[]
    };

    // Save transcript
    console.log('Saving transcript file...');
    const transcriptBuffer = Buffer.from(await transcript.arrayBuffer());
    const transcriptPath = join(sessionDir, `transcript.${getFileExtension(transcript.name)}`);
    await writeFile(transcriptPath, transcriptBuffer);
    savedFiles.transcript = transcriptPath;
    console.log('Transcript saved to:', transcriptPath);

    // Save note files
    console.log('Saving note files...');
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      console.log(`Saving note file ${i + 1}/${notes.length}: ${note.name}`);
      const noteBuffer = Buffer.from(await note.arrayBuffer());
      const notePath = join(sessionDir, note.name);
      await writeFile(notePath, noteBuffer);
      savedFiles.notes.push(notePath);
      console.log(`Note file saved to: ${notePath}`);
    }

    console.log('All files saved successfully, returning response');

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Files uploaded successfully',
      files: {
        transcript: transcript.name,
        notes: notes.map(note => note.name)
      }
    });

  } catch (error) {
    console.error('Upload error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    return NextResponse.json(
      { error: 'Failed to upload files: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop() || 'txt';
}