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
    const formData = await request.formData();
    
    const transcript = formData.get('transcript') as File;
    const notes = formData.getAll('notes') as File[];

    // Validation
    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript file is required' },
        { status: 400 }
      );
    }

    if (notes.length === 0) {
      return NextResponse.json(
        { error: 'At least one note file is required' },
        { status: 400 }
      );
    }

    // Validate file types and sizes
    const allFiles = [transcript, ...notes];
    for (const file of allFiles) {
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.txt')) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: .txt, .pdf, .docx, .md` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
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
    const savedFiles = {
      transcript: '',
      notes: [] as string[]
    };

    // Save transcript
    const transcriptBuffer = Buffer.from(await transcript.arrayBuffer());
    const transcriptPath = join(sessionDir, `transcript.${getFileExtension(transcript.name)}`);
    await writeFile(transcriptPath, transcriptBuffer);
    savedFiles.transcript = transcriptPath;

    // Save note files
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const noteBuffer = Buffer.from(await note.arrayBuffer());
      const notePath = join(sessionDir, note.name);
      await writeFile(notePath, noteBuffer);
      savedFiles.notes.push(notePath);
    }

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
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop() || 'txt';
}