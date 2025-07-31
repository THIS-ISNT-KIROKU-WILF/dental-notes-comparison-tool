import { NextRequest, NextResponse } from 'next/server';

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

    // Process files in memory instead of saving to disk
    console.log('Processing files in memory...');
    
    // Read transcript content
    const transcriptText = await transcript.text();
    console.log('Transcript processed:', transcriptText.length, 'characters');

    // Read note files content
    const noteContents = [];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      console.log(`Processing note file ${i + 1}/${notes.length}: ${note.name}`);
      const noteText = await note.text();
      noteContents.push({
        name: note.name,
        content: noteText
      });
      console.log(`Note file processed: ${note.name}, ${noteText.length} characters`);
    }

    console.log('All files processed in memory, returning data for evaluation');

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully',
      data: {
        transcriptName: transcript.name,
        transcriptContent: transcriptText,
        notes: noteContents
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

