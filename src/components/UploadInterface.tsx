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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

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
    const transcriptFile = transcriptInputRef.current?.files?.[0];
    const noteFiles = notesInputRef.current?.files;

    if (!transcriptFile || !noteFiles || noteFiles.length === 0) {
      setError('Please select a transcript file and at least one note file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('transcript', transcriptFile);
      
      Array.from(noteFiles).forEach(file => {
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
        setError(result.error || 'Upload failed');
      }
    } catch (error) {
      setError('Network error during upload');
    } finally {
      setIsUploading(false);
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
      const formData = new FormData();
      formData.append('zipFile', zipFile);

      const response = await fetch('/api/upload/batch', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResponse = await response.json();

      if (result.success) {
        onUploadSuccess(result);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (error) {
      setError('Network error during upload');
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
            <h3 className="text-lg font-semibold mb-4">Upload Individual Files</h3>
            <p className="text-gray-700 mb-6">
              Select one transcript file and multiple note versions for comparison.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Transcript File
            </label>
            <input
              ref={transcriptInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Note Files (select multiple)
            </label>
            <input
              ref={notesInputRef}
              type="file"
              multiple
              accept=".txt,.md,.pdf,.docx"
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>

          <button
            onClick={handleIndividualUpload}
            disabled={isUploading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload and Evaluate'}
          </button>
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