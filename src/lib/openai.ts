import OpenAI from 'openai';
import { OpenAIEvaluationPrompt, OpenAIEvaluationResponse, EvaluationResults } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Evaluates dental notes against a transcript using ChatGPT o3
 * Focuses on detail, truthfulness, and identifying falsehoods
 */
export async function evaluateDentalNotes({
  transcript,
  notes,
  noteFileName
}: OpenAIEvaluationPrompt): Promise<EvaluationResults> {
  try {
    const prompt = buildEvaluationPrompt(transcript, notes, noteFileName);
    
    const completion = await openai.chat.completions.create({
      model: "o3-2025-04-16", // Using o3 with proper model ID
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const parsed: OpenAIEvaluationResponse = JSON.parse(response);
    
    // Convert to our internal format
    return {
      detailScore: {
        score: parsed.detailScore,
        explanation: parsed.detailExplanation,
        examples: parsed.detailExamples
      },
      truthfulnessScore: {
        score: parsed.truthfulnessScore,
        explanation: parsed.truthfulnessExplanation,
        examples: parsed.truthfulnessExamples
      },
      falsehoods: parsed.falsehoods.map((f, index) => ({
        id: `falsehood_${Date.now()}_${index}`,
        description: f.description,
        severity: f.severity,
        location: f.location,
        correction: f.correction
      })),
      summary: parsed.summary,
      overallRanking: 0 // Will be calculated when comparing multiple notes
    };

  } catch (error) {
    console.error('OpenAI evaluation error:', error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('[OpenAI error]', message);
    throw new Error(`OpenAI-eval-error: ${message}`);
  }
}

/**
 * Compares multiple evaluations and assigns relative rankings
 */
export function rankEvaluations(evaluations: EvaluationResults[]): EvaluationResults[] {
  if (evaluations.length === 0) return evaluations;

  // Calculate composite scores for ranking
  const evaluationsWithComposite = evaluations.map((evaluation, index) => ({
    ...evaluation,
    compositeScore: (evaluation.detailScore.score + evaluation.truthfulnessScore.score) / 2,
    originalIndex: index
  }));

  // Sort by composite score (higher is better)
  evaluationsWithComposite.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign rankings (1 = best)
  evaluationsWithComposite.forEach((evaluation, index) => {
    evaluations[evaluation.originalIndex].overallRanking = index + 1;
  });

  return evaluations;
}

function buildEvaluationPrompt(transcript: string, notes: string, noteFileName: string): string {
  return `Please evaluate these dental notes against the original transcript.

**Original Transcript:**
${transcript}

**Notes to Evaluate (${noteFileName}):**
${notes}

Please evaluate the notes on the following criteria and respond with a JSON object:

1. **Detail Level (1-10)**: How comprehensive and detailed are the notes compared to the transcript?
2. **Truthfulness (1-10)**: How accurate are the notes compared to what actually happened in the transcript?
3. **Falsehoods**: Identify any specific inaccuracies, misrepresentations, or false information in the notes.

Focus particularly on:
- Clinical accuracy and terminology
- Completeness of information capture
- Any added information not present in the transcript
- Any omitted critical information from the transcript
- Factual errors or misinterpretations

Respond in JSON format matching this structure:
{
  "detailScore": 8,
  "detailExplanation": "Explanation of detail level...",
  "detailExamples": ["Example 1", "Example 2"],
  "truthfulnessScore": 9,
  "truthfulnessExplanation": "Explanation of truthfulness...", 
  "truthfulnessExamples": ["Example 1", "Example 2"],
  "falsehoods": [
    {
      "description": "Description of the falsehood",
      "severity": "high|medium|low",
      "location": "Where in the notes this appears",
      "correction": "What it should say instead"
    }
  ],
  "summary": "Overall assessment summary"
}`;
}

const SYSTEM_PROMPT = `You are an expert dental professional and clinical documentation reviewer. Your task is to evaluate dental notes against original transcripts for accuracy, completeness, and truthfulness.

Key principles:
- Be objective and evidence-based in your evaluations
- Focus on clinical accuracy and completeness
- Identify any discrepancies between transcript and notes
- Consider both omissions and additions as potential issues
- Provide specific examples to support your scores
- Use a scale where 10 is exceptional and 1 is severely lacking

For detail scores, consider:
- Completeness of clinical information
- Proper documentation of procedures, findings, and patient responses
- Inclusion of relevant context and details

For truthfulness scores, consider:
- Factual accuracy of recorded information
- Proper representation of what occurred
- Absence of misleading or false statements

For falsehoods, identify:
- Factual errors
- Misrepresentations of events
- Added information not supported by the transcript
- Significant omissions that change the clinical picture

Always respond with valid JSON matching the required structure.`;

/**
 * Batch evaluate multiple note files for the same transcript
 */
export async function batchEvaluateNotes(
  transcript: string,
  transcriptName: string,
  noteFiles: { filename: string; content: string }[]
): Promise<EvaluationResults[]> {
  const evaluations: EvaluationResults[] = [];
  
  for (const noteFile of noteFiles) {
    try {
      const evaluation = await evaluateDentalNotes({
        transcript,
        notes: noteFile.content,
        noteFileName: noteFile.filename
      });
      
      evaluations.push(evaluation);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to evaluate ${noteFile.filename}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  // Rank the evaluations relative to each other
  return rankEvaluations(evaluations);
}