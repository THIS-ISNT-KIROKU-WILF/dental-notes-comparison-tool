'use client';

import { useState } from 'react';
import UploadInterface from '@/components/UploadInterface';
import ResultsDisplay from '@/components/ResultsDisplay';
import { UploadResponse, Evaluation } from '@/types';

export default function Home() {
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleUploadSuccess = async (result: UploadResponse) => {
    console.log('Upload success, starting evaluation...', result);
    setUploadResult(result);
    
    setIsEvaluating(true);
    try {
      if (result.batchId && result.structure) {
        console.log('Making batch evaluation request...');
        // For batch uploads, send structure data to evaluation API
        const evaluationResponse = await fetch('/api/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batchId: result.batchId,
            batchData: result,
            transcriptText: '', // Not used for batch
            noteText: '', // Not used for batch
            noteFileName: '', // Not used for batch
            transcriptName: '' // Not used for batch
          }),
        });
        
        console.log('Batch evaluation response status:', evaluationResponse.status);
        const evaluationData = await evaluationResponse.json();
        console.log('Batch evaluation data:', evaluationData);
        
        if (evaluationData.success) {
          setEvaluations(evaluationData.evaluations || []);
          console.log('Set evaluations:', evaluationData.evaluations?.length || 0);
        } else {
          console.error('Evaluation failed:', evaluationData.error);
        }
      } else if (result.data) {
        console.log('Making individual evaluation requests for in-memory data...');
        // For individual uploads with in-memory data, evaluate each note
        const data = result.data;
        const allEvaluations: Evaluation[] = [];
        
        for (const note of data.notes) {
          console.log(`Evaluating ${note.name}...`);
          const evaluationResponse = await fetch('/api/evaluate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transcriptText: data.transcriptContent,
              noteText: note.content,
              noteFileName: note.name,
              transcriptName: data.transcriptName
            }),
          });
          
          const evaluationData = await evaluationResponse.json();
          
          if (evaluationData.success && evaluationData.evaluation) {
            allEvaluations.push(evaluationData.evaluation);
          } else {
            console.error(`Evaluation failed for ${note.name}:`, evaluationData.error);
          }
        }
        
        setEvaluations(allEvaluations);
        console.log('Set evaluations:', allEvaluations.length);
      } else if (result.sessionId) {
        console.log('Making individual evaluation request...');
        // For legacy file-based individual uploads, use the GET endpoint
        const evaluationResponse = await fetch(`/api/evaluate?sessionId=${result.sessionId}`);
        const evaluationData = await evaluationResponse.json();
        
        if (evaluationData.success) {
          setEvaluations(evaluationData.evaluations || []);
        }
      }
    } catch (error) {
      console.error('Failed to get evaluations:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const resetUpload = () => {
    setUploadResult(null);
    setEvaluations([]);
    setIsEvaluating(false);
  };

  return (
    <main className="min-h-screen relative flex justify-center items-center">

      <div className="container mx-auto px-4 py-8 relative z-10 light-frosting">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black-900 mb-4">
            Dental Notes Comparison Tool
          </h1>
          <p className="text-lg text-black-700 max-w-3xl mx-auto">
            Upload dental transcripts and multiple note versions to get AI-powered evaluations on 
            detail level, truthfulness, and accuracy. Compare notes side-by-side to identify 
            the best documentation practices.
          </p>
        </div>

        {!uploadResult ? (
          <div className="max-w-4xl mx-auto">
            <UploadInterface onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-black-900">
                Evaluation Results
              </h2>
              <button
                onClick={resetUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                New Upload
              </button>
            </div>

            {isEvaluating ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-lg text-gray-700">
                    Evaluating notes with AI... This may take a few minutes.
                  </span>
                </div>
              </div>
            ) : (
              <ResultsDisplay 
                uploadResult={uploadResult} 
                evaluations={evaluations}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}