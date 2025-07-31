'use client';

import { useState } from 'react';
import { UploadResponse, Evaluation } from '@/types';
import BatchSummary from './BatchSummary';

interface ResultsDisplayProps {
  uploadResult: UploadResponse;
  evaluations: Evaluation[];
}

function ContentToggle({ evaluation }: { evaluation: Evaluation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!evaluation.noteContent && !evaluation.transcriptContent) {
    return null;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 rounded-lg transition-colors"
        style={{background: 'rgba(255, 255, 255, 0.5)'}}
      >
        <span className="font-medium text-gray-900">
          View Original Content
        </span>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {evaluation.transcriptContent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                Original Transcript
              </h4>
              <div className="bg-white rounded p-3 text-sm text-gray-800 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {evaluation.transcriptContent}
              </div>
            </div>
          )}
          
          {evaluation.noteContent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
                Notes - {evaluation.noteFileName}
              </h4>
              <div className="bg-white rounded p-3 text-sm text-gray-800 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {evaluation.noteContent}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultsDisplay({ evaluations }: ResultsDisplayProps) {
  if (evaluations.length === 0) {
    return (
      <div className="frosted-glass p-8 text-center">
        <p className="text-gray-700">No evaluations available yet.</p>
      </div>
    );
  }

  const sortedEvaluations = [...evaluations].sort((a, b) => 
    a.results.overallRanking - b.results.overallRanking
  );

  // Check if this is a batch upload (multiple transcripts)
  const uniqueTranscripts = [...new Set(evaluations.map(e => e.transcriptName))];
  const isBatchUpload = uniqueTranscripts.length > 1;

  return (
    <div className="space-y-8">
      {/* Summary Statistics */}
      <div className="frosted-glass p-6">
        <h3 className="text-xl font-semibold mb-4">Evaluation Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="frosted-glass p-4">
            <div className="text-2xl font-bold text-blue-600">{evaluations.length}</div>
            <div className="text-sm font-medium text-blue-900">Notes Evaluated</div>
          </div>
          <div className="frosted-glass p-4">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(
                evaluations.reduce((sum, e) => sum + e.results.detailScore.score, 0) / evaluations.length
              )}
            </div>
            <div className="text-sm font-medium text-green-900">Avg Detail Score</div>
          </div>
          <div className="frosted-glass p-4">
            <div className="text-2xl font-bold text-amber-600">
              {Math.round(
                evaluations.reduce((sum, e) => sum + e.results.truthfulnessScore.score, 0) / evaluations.length
              )}
            </div>
            <div className="text-sm font-medium text-amber-900">Avg Truthfulness</div>
          </div>
        </div>
      </div>

      {/* Rankings Overview */}
      <div className="frosted-glass p-6">
        <h3 className="text-xl font-semibold mb-4">Performance Rankings</h3>
        <div className="space-y-3">
          {sortedEvaluations.map((evaluation, index) => (
            <div key={evaluation.id} className="frosted-glass p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                  index === 0 ? 'bg-gold-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{evaluation.noteFileName}</div>
                  <div className="text-sm text-gray-700 font-medium">
                    Detail: {evaluation.results.detailScore.score}/10 | 
                    Truthfulness: {evaluation.results.truthfulnessScore.score}/10
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                {evaluation.results.falsehoods.length > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    {evaluation.results.falsehoods.length} issue{evaluation.results.falsehoods.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Transcript Analysis (for batch uploads) */}
      {isBatchUpload && <BatchSummary evaluations={evaluations} />}

      {/* Detailed Evaluations */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Detailed Evaluations</h3>
        {sortedEvaluations.map((evaluation) => (
          <EvaluationCard key={evaluation.id} evaluation={evaluation} />
        ))}
      </div>
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="frosted-glass p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-lg font-semibold">{evaluation.noteFileName}</h4>
          <p className="text-sm text-gray-700">
            Evaluated on {new Date(evaluation.timestamp).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-700">Overall Ranking</div>
          <div className="text-2xl font-bold text-blue-600">#{evaluation.results.overallRanking}</div>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Detail Level</span>
            <span className="text-lg font-bold">{evaluation.results.detailScore.score}/10</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${evaluation.results.detailScore.score * 10}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-700">{evaluation.results.detailScore.explanation}</p>
          {evaluation.results.detailScore.examples.length > 0 && (
            <div className="text-sm">
              <div className="font-medium text-gray-700 mb-1">Examples:</div>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {evaluation.results.detailScore.examples.map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Truthfulness</span>
            <span className="text-lg font-bold">{evaluation.results.truthfulnessScore.score}/10</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full" 
              style={{ width: `${evaluation.results.truthfulnessScore.score * 10}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-700">{evaluation.results.truthfulnessScore.explanation}</p>
          {evaluation.results.truthfulnessScore.examples.length > 0 && (
            <div className="text-sm">
              <div className="font-medium text-gray-700 mb-1">Examples:</div>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {evaluation.results.truthfulnessScore.examples.map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Falsehoods */}
      {evaluation.results.falsehoods.length > 0 && (
        <div className="mb-6">
          <h5 className="font-medium text-gray-900 mb-3">Issues Identified</h5>
          <div className="space-y-3">
            {evaluation.results.falsehoods.map((falsehood) => (
              <div 
                key={falsehood.id} 
                className={`p-3 rounded-md border-l-4 ${
                  falsehood.severity === 'high' ? 'bg-red-50 border-red-500' :
                  falsehood.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-gray-900">{falsehood.description}</div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    falsehood.severity === 'high' ? 'bg-red-100 text-red-800' :
                    falsehood.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {falsehood.severity}
                  </span>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>Location:</strong> {falsehood.location}
                </div>
                <div className="text-sm text-gray-700">
                  <strong>Suggested correction:</strong> {falsehood.correction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded-md">
        <h5 className="font-medium text-gray-900 mb-2">AI Summary</h5>
        <p className="text-sm text-gray-700">{evaluation.results.summary}</p>
      </div>

      {/* Content Toggle */}
      <ContentToggle evaluation={evaluation} />
    </div>
  );
}