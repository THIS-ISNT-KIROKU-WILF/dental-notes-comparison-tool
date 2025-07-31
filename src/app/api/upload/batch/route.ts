import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for ZIP files

interface ExtractedFile {
  name: string;
  content: string;
  path: string;
}

interface TranscriptGroup {
  transcript: ExtractedFile | null;
  notes: ExtractedFile[];
}

interface ExtractedStructure {
  [transcriptDir: string]: TranscriptGroup;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const zipFile = formData.get('zipFile') as File;

    // Validation
    if (!zipFile) {
      return NextResponse.json(
        { error: 'ZIP file is required' },
        { status: 400 }
      );
    }

    if (!zipFile.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { error: 'File must be a ZIP archive' },
        { status: 400 }
      );
    }

    if (zipFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ZIP file is too large. Max size: 50MB' },
        { status: 400 }
      );
    }

    // Process ZIP file in memory
    const zipBytes = await zipFile.arrayBuffer();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipBytes);

    // Extract and organize files
    const extractedStructure = await extractZipStructure(loadedZip);

    // Generate batch ID for this processing session
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return NextResponse.json({
      success: true,
      message: 'Batch ZIP uploaded and processed successfully',
      batchId,
      structure: extractedStructure,
      noteGroups: analyzeNoteGroups(extractedStructure),
      summary: generateBatchSummary(extractedStructure)
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process ZIP file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

async function extractZipStructure(zip: JSZip): Promise<ExtractedStructure> {
  const structure: ExtractedStructure = {};

  // Process all files in the ZIP
  for (const [relativePath, file] of Object.entries(zip.files)) {
    // Skip directories and system files
    if (file.dir || 
        relativePath.includes('__MACOSX') || 
        relativePath.startsWith('.') ||
        relativePath.includes('.DS_Store')) {
      continue;
    }

    // Parse the path to determine transcript directory
    const pathParts = relativePath.split('/');
    if (pathParts.length < 2) {
      continue; // Skip files in root directory
    }

    const transcriptDir = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];

    // Only process text files
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.md')) {
      continue;
    }

    // Initialize transcript directory if not exists
    if (!structure[transcriptDir]) {
      structure[transcriptDir] = {
        transcript: null,
        notes: []
      };
    }

    try {
      // Read file content
      const content = await file.async('text');
      
      const extractedFile: ExtractedFile = {
        name: fileName,
        content,
        path: relativePath
      };

      // Categorize the file
      if (fileName.toLowerCase().includes('transcript')) {
        structure[transcriptDir].transcript = extractedFile;
      } else {
        structure[transcriptDir].notes.push(extractedFile);
      }
    } catch (error) {
      console.warn(`Failed to read file ${relativePath}:`, error);
      continue;
    }
  }

  return structure;
}

function analyzeNoteGroups(structure: ExtractedStructure) {
  const noteGroups: { [noteType: string]: number } = {};

  Object.values(structure).forEach(transcriptGroup => {
    transcriptGroup.notes.forEach(noteFile => {
      noteGroups[noteFile.name] = (noteGroups[noteFile.name] || 0) + 1;
    });
  });

  return noteGroups;
}

function generateBatchSummary(structure: ExtractedStructure) {
  const transcriptCount = Object.keys(structure).length;
  const totalNotes = Object.values(structure).reduce((sum, transcriptGroup) => 
    sum + transcriptGroup.notes.length, 0
  );

  const uniqueNoteTypes = new Set<string>();
  Object.values(structure).forEach(transcriptGroup => {
    transcriptGroup.notes.forEach(noteFile => uniqueNoteTypes.add(noteFile.name));
  });

  // Check for missing transcripts
  const transcriptsWithoutFile = Object.entries(structure)
    .filter(([, group]) => !group.transcript)
    .map(([name]) => name);

  return {
    transcriptCount,
    totalNotes,
    uniqueNoteTypes: uniqueNoteTypes.size,
    noteTypes: Array.from(uniqueNoteTypes),
    transcriptsWithoutFile
  };
}