'use client';

import { Evaluation } from '@/types';

interface BatchSummaryProps {
  evaluations: Evaluation[];
}

interface NoteTypeStats {
  filename: string;
  evaluations: Evaluation[];
  avgDetailScore: number;
  avgTruthfulnessScore: number;
  avgCompositeScore: number;
  totalFalsehoods: number;
  transcriptCount: number;
}

export default function BatchSummary({ evaluations }: BatchSummaryProps) {
  if (evaluations.length === 0) return null;

  // Group evaluations by note filename
  const noteTypeGroups = evaluations.reduce((acc, evaluation) => {
    const filename = evaluation.noteFileName;
    if (!acc[filename]) {
      acc[filename] = [];
    }
    acc[filename].push(evaluation);
    return acc;
  }, {} as { [filename: string]: Evaluation[] });

  // Calculate statistics for each note type
  const noteTypeStats: NoteTypeStats[] = Object.entries(noteTypeGroups).map(([filename, evals]) => {
    const avgDetailScore = evals.reduce((sum, e) => sum + e.results.detailScore.score, 0) / evals.length;
    const avgTruthfulnessScore = evals.reduce((sum, e) => sum + e.results.truthfulnessScore.score, 0) / evals.length;
    const avgCompositeScore = (avgDetailScore + avgTruthfulnessScore) / 2;
    const totalFalsehoods = evals.reduce((sum, e) => sum + e.results.falsehoods.length, 0);

    return {
      filename,
      evaluations: evals,
      avgDetailScore: Math.round(avgDetailScore * 10) / 10,
      avgTruthfulnessScore: Math.round(avgTruthfulnessScore * 10) / 10,
      avgCompositeScore: Math.round(avgCompositeScore * 10) / 10,
      totalFalsehoods,
      transcriptCount: evals.length
    };
  });

  // Sort by composite score (best first)
  const rankedNoteTypes = [...noteTypeStats].sort((a, b) => b.avgCompositeScore - a.avgCompositeScore);

  const transcriptNames = [...new Set(evaluations.map(e => e.transcriptName))];

  // Generate intelligent commentary
  const generateCommentary = (): string[] => {
    const commentary: string[] = [];
    
    if (rankedNoteTypes.length === 0) return commentary;

    const best = rankedNoteTypes[0];
    const worst = rankedNoteTypes[rankedNoteTypes.length - 1];
    
    // Performance comparison
    const scoreDiff = best.avgCompositeScore - worst.avgCompositeScore;
    if (scoreDiff > 2) {
      commentary.push(`There's a significant performance gap between note types, with ${best.filename} outperforming ${worst.filename} by ${scoreDiff.toFixed(1)} points on average.`);
    } else if (scoreDiff > 1) {
      commentary.push(`${best.filename} shows moderately better performance compared to other note types, leading by ${scoreDiff.toFixed(1)} points.`);
    } else {
      commentary.push(`Performance across note types is quite consistent, with only ${scoreDiff.toFixed(1)} points separating the best and worst performers.`);
    }

    // Detail vs Truthfulness analysis
    const mostDetailed = rankedNoteTypes.sort((a, b) => b.avgDetailScore - a.avgDetailScore)[0];
    const mostTruthful = rankedNoteTypes.sort((a, b) => b.avgTruthfulnessScore - a.avgTruthfulnessScore)[0];
    
    if (mostDetailed.filename === mostTruthful.filename && mostDetailed.filename === best.filename) {
      commentary.push(`${best.filename} excels in both detail and truthfulness, making it the clear winner across all evaluation criteria.`);
    } else if (mostDetailed.filename !== mostTruthful.filename) {
      commentary.push(`Interestingly, ${mostDetailed.filename} provides the most detailed notes while ${mostTruthful.filename} is most accurate, suggesting different strengths in documentation approaches.`);
    }

    // Consistency analysis
    const consistencyScores = rankedNoteTypes.map(noteType => {
      const scores = noteType.evaluations.map(e => (e.results.detailScore.score + e.results.truthfulnessScore.score) / 2);
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
      return { filename: noteType.filename, variance, scores };
    });
    
    const mostConsistent = consistencyScores.sort((a, b) => a.variance - b.variance)[0];
    const leastConsistent = consistencyScores.sort((a, b) => b.variance - a.variance)[0];
    
    if (mostConsistent.variance < 0.5) {
      commentary.push(`${mostConsistent.filename} demonstrates exceptional consistency across different transcripts, with minimal variation in quality.`);
    } else if (leastConsistent.variance > 2) {
      commentary.push(`${leastConsistent.filename} shows significant variation in quality across transcripts, suggesting inconsistent documentation practices.`);
    }

    // Issues/falsehoods analysis
    const totalFalsehoodsByType = rankedNoteTypes.map(nt => ({ 
      filename: nt.filename, 
      avgFalsehoods: nt.totalFalsehoods / nt.transcriptCount 
    }));
    const safest = totalFalsehoodsByType.sort((a, b) => a.avgFalsehoods - b.avgFalsehoods)[0];
    const riskiest = totalFalsehoodsByType.sort((a, b) => b.avgFalsehoods - a.avgFalsehoods)[0];
    
    if (safest.avgFalsehoods === 0) {
      commentary.push(`${safest.filename} maintains perfect accuracy with no identified issues across any transcript.`);
    } else if (riskiest.avgFalsehoods >= 2) {
      commentary.push(`${riskiest.filename} requires attention, averaging ${riskiest.avgFalsehoods.toFixed(1)} issues per transcript, which could impact clinical accuracy.`);
    }

    // Quality threshold analysis
    const highQuality = rankedNoteTypes.filter(nt => nt.avgCompositeScore >= 8);
    const lowQuality = rankedNoteTypes.filter(nt => nt.avgCompositeScore < 6);
    
    if (highQuality.length === rankedNoteTypes.length) {
      commentary.push(`All note types demonstrate high quality documentation standards, scoring above 8/10 on average.`);
    } else if (lowQuality.length > 0) {
      commentary.push(`${lowQuality.map(nt => nt.filename).join(' and ')} ${lowQuality.length === 1 ? 'falls' : 'fall'} below acceptable quality thresholds and may need process improvements.`);
    }

    return commentary;
  };

  const commentary = generateCommentary();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h3 className="text-xl font-semibold mb-6">Cross-Transcript Analysis</h3>
      <p className="text-gray-700 mb-6">
        Analyzing and comparing note-taking performance across <strong>{transcriptNames.length} transcripts</strong>: {transcriptNames.join(', ')}
      </p>

      {/* Overall Rankings */}
      <div className="mb-8">
        <h4 className="text-lg font-medium mb-4">Note Type Performance Rankings</h4>
        <div className="space-y-4">
          {rankedNoteTypes.map((noteType, index) => (
            <div key={noteType.filename} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h5 className="font-semibold text-lg">{noteType.filename}</h5>
                    <p className="text-sm text-gray-700">
                      Evaluated across {noteType.transcriptCount} transcript{noteType.transcriptCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{noteType.avgCompositeScore}</div>
                  <div className="text-sm text-gray-700">Avg Score</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded-md">
                  <div className="text-lg font-semibold text-blue-600">{noteType.avgDetailScore}</div>
                  <div className="text-sm text-blue-900 font-medium">Avg Detail Score</div>
                </div>
                <div className="bg-green-50 p-3 rounded-md">
                  <div className="text-lg font-semibold text-green-600">{noteType.avgTruthfulnessScore}</div>
                  <div className="text-sm text-green-900 font-medium">Avg Truthfulness</div>
                </div>
                <div className="bg-red-50 p-3 rounded-md">
                  <div className="text-lg font-semibold text-red-600">{noteType.totalFalsehoods}</div>
                  <div className="text-sm text-red-900 font-medium">Total Issues</div>
                </div>
              </div>

              {/* Individual transcript breakdown */}
              <div className="mt-4">
                <h6 className="font-medium text-gray-900 mb-2">Breakdown by Transcript:</h6>
                <div className="space-y-2">
                  {noteType.evaluations.map((evaluation) => (
                    <div key={`${evaluation.transcriptName}-${evaluation.id}`} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <span className="text-sm font-medium text-gray-900">{evaluation.transcriptName}</span>
                      <div className="flex space-x-4 text-sm text-gray-700">
                        <span>Detail: {evaluation.results.detailScore.score}/10</span>
                        <span>Truth: {evaluation.results.truthfulnessScore.score}/10</span>
                        <span className="text-red-600">{evaluation.results.falsehoods.length} issues</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Commentary */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md mb-6">
        <h4 className="font-medium text-blue-900 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          AI Analysis Commentary
        </h4>
        <div className="space-y-3 text-sm text-blue-800">
          {commentary.map((comment, index) => (
            <p key={index} className="leading-relaxed">{comment}</p>
          ))}
        </div>
      </div>

      {/* Summary Insights */}
      <div className="bg-gray-50 p-4 rounded-md">
        <h4 className="font-medium text-gray-900 mb-3">Quick Stats</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700">
          <div>
            <div className="font-semibold text-gray-900">{rankedNoteTypes[0]?.filename}</div>
            <div>Best Overall ({rankedNoteTypes[0]?.avgCompositeScore}/10)</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {rankedNoteTypes.sort((a, b) => b.avgDetailScore - a.avgDetailScore)[0]?.filename}
            </div>
            <div>Most Detailed</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {rankedNoteTypes.sort((a, b) => b.avgTruthfulnessScore - a.avgTruthfulnessScore)[0]?.filename}
            </div>
            <div>Most Truthful</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {rankedNoteTypes.sort((a, b) => a.totalFalsehoods - b.totalFalsehoods)[0]?.filename}
            </div>
            <div>Fewest Issues</div>
          </div>
        </div>
      </div>
    </div>
  );
}