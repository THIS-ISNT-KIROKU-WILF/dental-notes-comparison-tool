import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, createWriteStream } from 'fs';
import yauzl from 'yauzl';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for ZIP files

interface ExtractedStructure {
  [transcriptDir: string]: {
    transcript?: string;
    notes: string[];
  };
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

    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Create batch session directory
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchDir = join(UPLOAD_DIR, batchId);
    await mkdir(batchDir, { recursive: true });

    // Save and extract ZIP file
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    const zipPath = join(batchDir, zipFile.name);
    await writeFile(zipPath, zipBuffer);

    // Extract ZIP file
    const extractedStructure = await extractZipFile(zipPath, batchDir);
    
    // Validate structure
    const validationResult = validateBatchStructure(extractedStructure);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Group note files by filename across transcripts
    const noteGroups = groupNotesByFilename(extractedStructure);

    return NextResponse.json({
      success: true,
      batchId,
      message: 'ZIP file processed successfully',
      transcripts: Object.keys(extractedStructure),
      structure: extractedStructure,
      noteGroups,
      summary: {
        transcriptCount: Object.keys(extractedStructure).length,
        uniqueNoteTypes: Object.keys(noteGroups)
      }
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process ZIP file' },
      { status: 500 }
    );
  }
}

async function extractZipFile(zipPath: string, extractDir: string): Promise<ExtractedStructure> {
  return new Promise((resolve, reject) => {
    const structure: ExtractedStructure = {};

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }

      if (!zipfile) {
        reject(new Error('Failed to open ZIP file'));
        return;
      }

      zipfile.readEntry();

      zipfile.on('entry', async (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          zipfile.readEntry();
          return;
        }

        // Parse the file path
        const pathParts = entry.fileName.split('/');
        if (pathParts.length !== 2) {
          zipfile.readEntry();
          return;
        }

        const [transcriptDir, fileName] = pathParts;

        // Initialize transcript directory in structure if not exists
        if (!structure[transcriptDir]) {
          structure[transcriptDir] = {
            notes: []
          };
        }

        // Extract file
        zipfile.openReadStream(entry, async (err, readStream) => {
          if (err) {
            reject(err);
            return;
          }

          if (!readStream) {
            reject(new Error('Failed to create read stream'));
            return;
          }

          const extractPath = join(extractDir, transcriptDir);
          await mkdir(extractPath, { recursive: true });
          
          const filePath = join(extractPath, fileName);
          const writeStream = createWriteStream(filePath);

          readStream.pipe(writeStream);

          writeStream.on('close', () => {
            // Categorize the file
            if (fileName.toLowerCase().includes('transcript')) {
              structure[transcriptDir].transcript = fileName;
            } else {
              structure[transcriptDir].notes.push(fileName);
            }
            zipfile.readEntry();
          });

          writeStream.on('error', (err: Error) => {
            reject(err);
          });
        });
      });

      zipfile.on('end', () => {
        resolve(structure);
      });

      zipfile.on('error', (err) => {
        reject(err);
      });
    });
  });
}

function validateBatchStructure(structure: ExtractedStructure): { isValid: boolean; error?: string } {
  const transcriptDirs = Object.keys(structure);
  
  if (transcriptDirs.length === 0) {
    return { isValid: false, error: 'No transcript directories found in ZIP file' };
  }

  for (const dir of transcriptDirs) {
    const { transcript, notes } = structure[dir];
    
    if (!transcript) {
      return { 
        isValid: false, 
        error: `No transcript file found in directory: ${dir}. Expected a file containing 'transcript' in the name.` 
      };
    }

    if (notes.length === 0) {
      return { 
        isValid: false, 
        error: `No note files found in directory: ${dir}. Each transcript directory must contain note files.` 
      };
    }
  }

  return { isValid: true };
}

function groupNotesByFilename(structure: ExtractedStructure): { [filename: string]: string[] } {
  const noteGroups: { [filename: string]: string[] } = {};
  
  for (const [transcriptDir, content] of Object.entries(structure)) {
    for (const noteFile of content.notes) {
      if (!noteGroups[noteFile]) {
        noteGroups[noteFile] = [];
      }
      noteGroups[noteFile].push(transcriptDir);
    }
  }

  return noteGroups;
}