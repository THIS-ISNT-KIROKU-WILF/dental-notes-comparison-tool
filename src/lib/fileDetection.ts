import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export interface DetectedStructure {
  [transcriptDir: string]: {
    transcriptFile?: string;
    noteFiles: string[];
    fullPaths: {
      transcriptPath?: string;
      notePaths: { [filename: string]: string };
    };
  };
}

export interface NoteGrouping {
  [noteFilename: string]: {
    transcriptDirs: string[];
    count: number;
    missingFrom: string[];
  };
}

/**
 * Scans a directory structure to detect transcript directories and group note files
 * Supports the expected structure: transcript1/transcript.txt, transcript1/notes-*.txt
 */
export async function detectFileStructure(baseDir: string): Promise<DetectedStructure> {
  const structure: DetectedStructure = {};
  
  try {
    const entries = await readdir(baseDir);
    
    for (const entry of entries) {
      const entryPath = join(baseDir, entry);
      const entryStat = await stat(entryPath);
      
      if (entryStat.isDirectory()) {
        // This is a transcript directory
        const transcriptContent = await analyzeTranscriptDirectory(entryPath);
        if (transcriptContent.transcriptFile || transcriptContent.noteFiles.length > 0) {
          structure[entry] = transcriptContent;
        }
      }
    }
    
    return structure;
  } catch (error) {
    console.error('Error detecting file structure:', error);
    throw new Error('Failed to detect file structure');
  }
}

/**
 * Analyzes a single transcript directory to identify transcript and note files
 */
async function analyzeTranscriptDirectory(dirPath: string) {
  const content = {
    transcriptFile: undefined as string | undefined,
    noteFiles: [] as string[],
    fullPaths: {
      transcriptPath: undefined as string | undefined,
      notePaths: {} as { [filename: string]: string }
    }
  };

  try {
    const files = await readdir(dirPath);
    
    for (const file of files) {
      const filePath = join(dirPath, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isFile() && isTextFile(file)) {
        if (isTranscriptFile(file)) {
          content.transcriptFile = file;
          content.fullPaths.transcriptPath = filePath;
        } else {
          content.noteFiles.push(file);
          content.fullPaths.notePaths[file] = filePath;
        }
      }
    }
    
    return content;
  } catch (error) {
    console.error(`Error analyzing directory ${dirPath}:`, error);
    return content;
  }
}

/**
 * Groups note files by filename across all transcript directories
 */
export function groupNotesByFilename(structure: DetectedStructure): NoteGrouping {
  const allTranscriptDirs = Object.keys(structure);
  const noteGroups: NoteGrouping = {};
  
  // Collect all unique note filenames
  const allNoteFilenames = new Set<string>();
  for (const [, content] of Object.entries(structure)) {
    content.noteFiles.forEach(filename => allNoteFilenames.add(filename));
  }
  
  // Group transcripts by note filename
  for (const noteFilename of allNoteFilenames) {
    const transcriptDirsWithThisNote: string[] = [];
    const transcriptDirsMissingThisNote: string[] = [];
    
    for (const transcriptDir of allTranscriptDirs) {
      const content = structure[transcriptDir];
      if (content.noteFiles.includes(noteFilename)) {
        transcriptDirsWithThisNote.push(transcriptDir);
      } else {
        transcriptDirsMissingThisNote.push(transcriptDir);
      }
    }
    
    noteGroups[noteFilename] = {
      transcriptDirs: transcriptDirsWithThisNote,
      count: transcriptDirsWithThisNote.length,
      missingFrom: transcriptDirsMissingThisNote
    };
  }
  
  return noteGroups;
}

/**
 * Validates that the detected structure has the minimum required files
 */
export function validateDetectedStructure(structure: DetectedStructure): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const transcriptDirs = Object.keys(structure);
  
  if (transcriptDirs.length === 0) {
    errors.push('No transcript directories found');
    return { isValid: false, errors, warnings };
  }
  
  for (const transcriptDir of transcriptDirs) {
    const content = structure[transcriptDir];
    
    if (!content.transcriptFile) {
      errors.push(`No transcript file found in directory: ${transcriptDir}`);
    }
    
    if (content.noteFiles.length === 0) {
      errors.push(`No note files found in directory: ${transcriptDir}`);
    }
  }
  
  // Check for consistency across transcript directories
  const noteGroups = groupNotesByFilename(structure);
  for (const [noteFilename, group] of Object.entries(noteGroups)) {
    if (group.missingFrom.length > 0) {
      warnings.push(
        `Note file "${noteFilename}" is missing from: ${group.missingFrom.join(', ')}`
      );
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Checks if a file is likely a transcript file based on filename patterns
 */
function isTranscriptFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return lowerName.includes('transcript') || lowerName === 'transcript.txt';
}

/**
 * Checks if a file is a supported text file type
 */
function isTextFile(filename: string): boolean {
  const supportedExtensions = ['.txt', '.md', '.text'];
  const lowerName = filename.toLowerCase();
  return supportedExtensions.some(ext => lowerName.endsWith(ext));
}