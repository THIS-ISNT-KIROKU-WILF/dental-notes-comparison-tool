'use client';

import { useState, useRef } from 'react';
import { UploadResponse } from '@/types';

interface UploadInterfaceProps {
  onUploadSuccess: (result: UploadResponse) => void;
}

export default function UploadInterface({ onUploadSuccess }: UploadInterfaceProps) {
  const [uploadMode, setUploadMode] = useState<'individual' | 'batch'>('individual');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [noteFiles, setNoteFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    
    if (uploadMode === 'batch') {
      handleBatchUpload(files);
    } else {
      // For individual mode, we need to distinguish transcript vs notes
      // This is a simplified version - in a real app you might want a more sophisticated UI
      console.log('Individual drag upload not fully implemented - use file inputs');
    }
  };

  const handleIndividualUpload = async () => {
    if (!transcriptFile || noteFiles.length === 0) {
      setError('Please provide both transcript and note files');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('transcript', transcriptFile);
      
      noteFiles.forEach(file => {
        formData.append('notes', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResponse = await response.json();

      if (result.success) {
        onUploadSuccess(result);
      } else {
        console.error('Individual upload unsuccessful:', result.error);
        setError(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Network error during individual upload:', error);
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Auto-detect transcript and note files based on naming convention
  const detectFileTypes = (files: File[]) => {
    const transcript = files.find(file => 
      file.name.toLowerCase().includes('transcript')
    );
    
    const notes = files.filter(file => 
      !file.name.toLowerCase().includes('transcript') &&
      (file.name.endsWith('.txt') || file.name.endsWith('.md'))
    );

    return { transcript, notes };
  };

  const handleIndividualDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleIndividualFileSelect(files);
  };

  const handleIndividualFileSelect = (files: File[]) => {
    const { transcript, notes } = detectFileTypes(files);
    
    if (transcript) {
      setTranscriptFile(transcript);
    }
    
    if (notes.length > 0) {
      setNoteFiles(notes);
    }

    if (!transcript && notes.length === 0) {
      setError('No valid files detected. Please include files with "transcript" in the name and note files.');
    } else if (!transcript) {
      setError('No transcript file detected. Please include a file with "transcript" in the name.');
    } else if (notes.length === 0) {
      setError('No note files detected. Please include .txt or .md files (not containing "transcript").');
    } else {
      setError(null);
    }
  };

  const handleBatchUpload = async (files?: File[]) => {
    let zipFile: File | undefined;

    if (files) {
      zipFile = files.find(file => file.name.toLowerCase().endsWith('.zip'));
    } else {
      zipFile = fileInputRef.current?.files?.[0];
    }

    if (!zipFile) {
      setError('Please select a ZIP file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      console.log('Starting batch upload...', { fileName: zipFile.name, size: zipFile.size });
      
      const formData = new FormData();
      formData.append('zipFile', zipFile);

      const response = await fetch('/api/upload/batch', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed with status:', response.status, 'Error:', errorText);
        setError(`Upload failed (${response.status}): ${errorText}`);
        return;
      }

      const result: UploadResponse = await response.json();
      console.log('Upload result:', result);

      if (result.success) {
        onUploadSuccess(result);
      } else {
        console.error('Upload unsuccessful:', result.error);
        setError(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Network error during upload:', error);
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Mode Selection */}
      <div className="mb-8">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setUploadMode('individual')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              uploadMode === 'individual'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Individual Upload
          </button>
          <button
            onClick={() => setUploadMode('batch')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              uploadMode === 'batch'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Batch Upload (ZIP)
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {uploadMode === 'individual' ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Individual Upload</h3>
            <p className="text-gray-700 mb-6">
              Drop all files at once - we&apos;ll automatically detect the transcript and note files based on their names.
            </p>

            {/* Drag and Drop Zone */}
            <div
              onDrop={(e) => handleIndividualDrop(e)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md"
                onChange={(e) => handleIndividualFileSelect(Array.from(e.target.files || []))}
                className="hidden"
              />
              
              <svg className="mx-auto h-12 w-12 text-gray-600" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              
              <div className="mt-4">
                <p className="text-lg text-gray-700 font-medium">Drop your files here, or click to browse</p>
                <p className="text-gray-600 mt-2">
                  Include one transcript file and multiple note files<br/>
                  <span className="text-sm">Files with &quot;transcript&quot; in the name will be detected as transcripts</span>
                </p>
              </div>
            </div>

            {/* File Detection Results */}
            {(transcriptFile || noteFiles.length > 0) && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Detected Files</h4>
                
                {transcriptFile && (
                  <div className="mb-2">
                    <div className="flex items-center text-sm">
                      <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-blue-900">Transcript:</span>
                      <span className="ml-2 text-gray-700">{transcriptFile.name}</span>
                    </div>
                  </div>
                )}

                {noteFiles.length > 0 && (
                  <div>
                    <div className="flex items-start text-sm">
                      <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <span className="font-medium text-green-900">Notes ({noteFiles.length}):</span>
                        <div className="ml-0 mt-1 space-y-1">
                          {noteFiles.map((file, index) => (
                            <div key={index} className="text-gray-700 text-xs">• {file.name}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(!transcriptFile && noteFiles.length === 0) && (
                  <p className="text-gray-600 text-sm">No files detected yet</p>
                )}
              </div>
            )}

            <button
              onClick={handleIndividualUpload}
              disabled={!transcriptFile || noteFiles.length === 0 || isUploading}
              className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Processing...' : `Evaluate ${noteFiles.length} Note${noteFiles.length !== 1 ? 's' : ''} Against Transcript`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Upload ZIP File</h3>
            <p className="text-gray-700 mb-6">
              Upload a ZIP file with the following structure:<br/>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-900">
                transcript1/transcript.txt, transcript1/notes-4o.txt, transcript1/notes-o3.txt, etc.
              </code>
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="space-y-4">
              <div className="text-gray-700">
                <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Drop your ZIP file here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    browse
                  </button>
                </p>
                <p className="text-sm text-gray-700">ZIP files up to 50MB</p>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={() => handleBatchUpload()}
          />

          <button
            onClick={() => handleBatchUpload()}
            disabled={isUploading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? 'Processing...' : 'Process ZIP File'}
          </button>
        </div>
      )}
    </div>
  );
}