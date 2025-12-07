import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedQuestion {
  question_text: string;
  options: string[];
  correct_answer: string;
  marks: number;
  image_description?: string;
  table_description?: string;
  passage_title?: string;
  passage_text?: string;
  passage_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { extractedText, difficulty, images = [], tables = [], passages = [] } = await req.json();

    if (!extractedText) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert at parsing educational assessment questions from OCR text.
Your task is to extract multiple-choice questions (MCQs) and properly link them to passages.

CRITICAL RULES:

1. PASSAGE LINKING:
   - If a question has [BELONGS_TO_PASSAGE: Title] marker, include that passage info
   - Set passage_id as a slug of the title (e.g., "passage-a-water-cycle")
   - Include passage_title and passage_text for questions that belong to passages
   - All questions belonging to the same passage should share the same passage_id

2. TABLE HANDLING:
   - If [TABLE_IMAGE_N: description] appears near a question, include table_description
   - Tables should be referenced as images in the quiz display

3. IMAGE HANDLING:
   - If [IMAGE_N: description] appears near a question, include image_description

4. QUESTION EXTRACTION:
   - Extract question text, all options (A, B, C, D), correct answer
   - Default marks to 1 unless specified
   - Clean up any OCR artifacts

Return JSON in this exact format:
{
  "questions": [
    {
      "question_text": "Complete question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "A",
      "marks": 1,
      "image_description": "Description if image present, null otherwise",
      "table_description": "Description if table present, null otherwise", 
      "passage_id": "passage-slug if belongs to passage, null otherwise",
      "passage_title": "Passage title if applicable",
      "passage_text": "Full passage text if applicable"
    }
  ]
}

IMPORTANT:
- passage_text should only be included ONCE for the first question of each passage
- Subsequent questions in the same passage only need passage_id
- Return ONLY valid JSON, no other text`;

    const passageInfo = passages.length > 0 
      ? `\n\nDetected ${passages.length} passages:\n${passages.map((p: any) => `- "${p.title}"`).join('\n')}`
      : '';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse the following OCR text and extract all MCQ questions with proper passage linking.${passageInfo}\n\nOCR Text:\n${extractedText}` }
        ],
        max_tokens: 12000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from the response
    let parsed: { questions: ParsedQuestion[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse AI response',
          rawContent: content.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and clean the parsed questions
    const validQuestions = (parsed.questions || []).filter((q: ParsedQuestion) => 
      q.question_text && 
      Array.isArray(q.options) && 
      q.options.length >= 2 &&
      q.correct_answer
    ).map((q: ParsedQuestion, index: number) => ({
      ...q,
      difficulty: difficulty || 'easy',
      order_index: index,
      marks: q.marks || 1,
      correct_answer: q.correct_answer.toUpperCase().charAt(0),
      image_description: q.image_description || null,
      table_description: q.table_description || null,
      passage_id: q.passage_id || null,
      passage_title: q.passage_title || null,
      passage_text: q.passage_text || null,
    }));

    console.log(`Parsed ${validQuestions.length} questions. Passages linked: ${validQuestions.filter(q => q.passage_id).length}`);

    return new Response(
      JSON.stringify({ 
        questions: validQuestions,
        totalFound: validQuestions.length,
        imagesDetected: images.length,
        tablesDetected: tables.length,
        passagesDetected: passages.length,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Parse questions error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse questions';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
