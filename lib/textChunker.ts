/**
 * Utility for splitting text into realistic LLM-style chunks for streaming simulation
 */

export interface TextChunk {
  text: string;
  index: number;
  isComplete: boolean;
}

/**
 * Split text into chunks that simulate how an LLM might generate text
 * - Respects sentence boundaries when possible
 * - Creates chunks of varying sizes (like real LLM output)
 * - Ensures chunks are meaningful units
 */
export function splitTextIntoChunks(text: string, options?: {
  minChunkSize?: number;
  maxChunkSize?: number;
  preferSentenceBoundaries?: boolean;
}): TextChunk[] {
  const {
    minChunkSize = 150,
    maxChunkSize = 300,
    preferSentenceBoundaries = true
  } = options || {};

  if (!text.trim()) return [];

  const chunks: TextChunk[] = [];
  let remainingText = text.trim();
  let chunkIndex = 0;

  while (remainingText.length > 0) {
    let chunkSize = minChunkSize + Math.random() * (maxChunkSize - minChunkSize);
    chunkSize = Math.floor(chunkSize);
    
    // Don't make the last chunk too small
    if (remainingText.length - chunkSize < minChunkSize / 2) {
      chunkSize = remainingText.length;
    }

    let chunkText = remainingText.substring(0, chunkSize);
    
    // Try to break at sentence boundaries if enabled and we're not at the end
    if (preferSentenceBoundaries && chunkSize < remainingText.length) {
      // Look for sentence endings within the chunk
      const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let bestBreak = -1;
      
      for (const ending of sentenceEndings) {
        const lastIndex = chunkText.lastIndexOf(ending);
        if (lastIndex > minChunkSize / 2) { // Don't break too early
          bestBreak = Math.max(bestBreak, lastIndex + ending.length);
        }
      }
      
      // If no good sentence break, try to break at word boundaries
      if (bestBreak === -1) {
        const lastSpace = chunkText.lastIndexOf(' ');
        if (lastSpace > minChunkSize / 2) {
          bestBreak = lastSpace + 1;
        }
      }
      
      if (bestBreak > 0) {
        chunkText = remainingText.substring(0, bestBreak);
      }
    }

    // Add the chunk
    chunks.push({
      text: chunkText.trim(),
      index: chunkIndex,
      isComplete: false
    });

    // Move to next chunk
    remainingText = remainingText.substring(chunkText.length).trim();
    chunkIndex++;
  }

  // Mark the last chunk as complete
  if (chunks.length > 0) {
    chunks[chunks.length - 1].isComplete = true;
  }

  return chunks;
}

/**
 * Predefined example texts that work well for interruption testing
 */
export const interruptionTestTexts = [
  {
    id: 'story',
    title: 'Short Story',
    text: 'Once upon a time, in a magical forest filled with ancient trees and mystical creatures, there lived a wise old owl named Oliver. Oliver had spent many years learning the secrets of the forest, and he was known throughout the land for his wisdom and kindness. One day, a young rabbit named Ruby came to Oliver with a problem. She had lost her way home and didn\'t know how to find her family. Oliver listened carefully to Ruby\'s story, nodding his head thoughtfully as she spoke.',
    description: 'Narrative text with natural pauses'
  },
  {
    id: 'technical',
    title: 'Technical Explanation',
    text: 'Artificial intelligence systems rely on complex neural networks that process information in layers, similar to how the human brain works. Each layer analyzes different aspects of the input data, gradually building up a more sophisticated understanding of the content. Machine learning algorithms train these networks by adjusting the strength of connections between artificial neurons based on the patterns they detect in training data. This process allows AI systems to recognize speech, understand language, generate text, and even create images.',
    description: 'Technical content with complex sentences'
  },
  {
    id: 'conversation',
    title: 'Conversational',
    text: 'Hey there! I hope you\'re having a great day today. I wanted to talk to you about something really interesting that happened to me yesterday. I was walking through the park when I noticed this incredible street musician playing the most beautiful violin music I\'d ever heard. The melody was so captivating that I just had to stop and listen. Other people started gathering around too, and before we knew it, there was a whole crowd of us just enjoying this amazing performance together. What made it even more special was how the musician seemed to notice our growing audience and started playing with even more passion and energy. The music filled the entire park, creating this magical atmosphere where strangers became connected through the shared experience of beautiful art. It reminded me why live music is so powerful - there\'s something about being in the same physical space as the artist that creates an emotional connection that you just can\'t get from recorded music. After about thirty minutes, the musician finished with a stunning crescendo that left everyone speechless for a moment before we all erupted in enthusiastic applause.',
    description: 'Casual, conversational tone'
  },
  {
    id: 'instructions',
    title: 'Step-by-Step Instructions',
    text: 'To successfully bake a chocolate cake from scratch, you will need to gather the following ingredients: flour, sugar, cocoa powder, baking soda, salt, eggs, milk, and vanilla extract. First, preheat your oven to 350 degrees Fahrenheit and grease a round cake pan. In a large mixing bowl, combine all the dry ingredients and whisk them together thoroughly. Next, create a well in the center of the dry ingredients and add the wet ingredients one at a time, mixing gently after each addition.',
    description: 'Sequential instructions with clear steps'
  }
];

/**
 * Get a predefined text example by ID
 */
export function getInterruptionTestText(id: string) {
  return interruptionTestTexts.find(text => text.id === id);
}