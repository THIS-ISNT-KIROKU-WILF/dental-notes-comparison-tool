// Core data types for the dental notes comparison tool

export interface TranscriptSession {
  sessionId: string;
  transcriptFile: string;
  noteFiles: string[];
  createdAt: Date;
  evaluations?: Evaluation[];
}

export interface BatchSession {
  batchId: string;
  transcripts: TranscriptData[];
  noteGroups: NoteGroup[];
  createdAt: Date;
  summary?: BatchSummary;
}

export interface TranscriptData {
  transcriptDir: string;
  transcriptFile: string;
  noteFiles: string[];
  evaluations?: Evaluation[];
}

export interface NoteGroup {
  filename: string;
  transcriptDirs: string[];
  averageScores?: {
    detailScore: number;
    truthfulnessScore: number;
    overallRanking: number;
  };
}

export interface Evaluation {
  id: string;
  transcriptName: string;
  noteFileName: string;
  results: EvaluationResults;
  timestamp: Date;
  noteContent?: string; // The actual notes text
  transcriptContent?: string; // The actual transcript text
}

export interface EvaluationResults {
  detailScore: {
    score: number; // 1-10
    explanation: string;
    examples: string[];
  };
  truthfulnessScore: {
    score: number; // 1-10
    explanation: string;
    examples: string[];
  };
  falsehoods: Falsehood[];
  summary: string;
  overallRanking: number; // relative ranking within the set
}

export interface Falsehood {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location: string; // where in the notes this appears
  correction: string; // what should it say instead
}

export interface BatchSummary {
  transcriptCount: number;
  uniqueNoteTypes: string[];
  crossTranscriptComparisons: NoteTypeComparison[];
  topPerformingNoteType: string;
  overallInsights: string[];
}

export interface NoteTypeComparison {
  noteFileName: string;
  averageDetailScore: number;
  averageTruthfulnessScore: number;
  overallRanking: number;
  commonFalsehoods: Falsehood[];
  transcriptCount: number;
}

// API response types
export interface UploadResponse {
  success: boolean;
  sessionId?: string;
  batchId?: string;
  message: string;
  error?: string;
  files?: {
    transcript: string;
    notes: string[];
  };
  data?: {
    transcriptName: string;
    transcriptContent: string;
    notes: Array<{ name: string; content: string }>;
  };
  structure?: Record<string, unknown>;
  noteGroups?: Record<string, unknown>;
  summary?: Record<string, unknown>;
}

export interface BatchData {
  batchId: string;
  structure: Record<string, {
    transcript: { content: string } | null;
    notes: Array<{ name: string; content: string }>;
  }>;
  noteGroups: Record<string, number>;
  summary: Record<string, unknown>;
}

export interface EvaluationRequest {
  sessionId?: string;
  batchId?: string;
  batchData?: BatchData; // For in-memory batch processing
  transcriptText: string;
  noteText: string;
  noteFileName: string;
  transcriptName: string;
}

export interface EvaluationResponse {
  success: boolean;
  evaluation?: Evaluation;
  error?: string;
}

// OpenAI integration types
export interface OpenAIEvaluationPrompt {
  transcript: string;
  notes: string;
  noteFileName: string;
}

export interface OpenAIEvaluationResponse {
  detailScore: number;
  detailExplanation: string;
  detailExamples: string[];
  truthfulnessScore: number;
  truthfulnessExplanation: string;
  truthfulnessExamples: string[];
  falsehoods: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    location: string;
    correction: string;
  }>;
  summary: string;
}