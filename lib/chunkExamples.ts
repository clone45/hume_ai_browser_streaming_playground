// Predefined examples that simulate LLM chunked output
// Each example is an array of complete sentences

export interface ChunkExample {
  id: string;
  title: string;
  description: string;
  chunks: string[];
}

export const chunkExamples: ChunkExample[] = [
  {
    id: 'greeting',
    title: 'Simple Greeting',
    description: 'Basic 4-sentence greeting',
    chunks: [
      'Hello there, how are you doing today?',
      'I hope you\'re having a wonderful time.',
      'zebra xylophone quintessential quasar!',
      'Is there anything I can help you with?'
    ]
  },
  {
    id: 'weather',
    title: 'Weather Report',
    description: 'Longer weather discussion',
    chunks: [
      'Good morning, let me give you today\'s weather forecast.',
      'Currently, it\'s partly cloudy with temperatures around 72 degrees.',
      'We\'re expecting some light rain this afternoon around 3 PM.',
      'The high today will be 78 degrees with winds from the southwest.',
      'Tomorrow looks much brighter with sunny skies and a high of 82.',
      'Don\'t forget to bring an umbrella if you\'re heading out this afternoon!'
    ]
  },
  {
    id: 'story',
    title: 'Short Story',
    description: 'Narrative with varying sentence lengths',
    chunks: [
      'Once upon a time, in a small village nestled between rolling hills, there lived a curious young inventor named Maya.',
      'She spent her days tinkering with gears and springs in her cluttered workshop.',
      'One morning, Maya discovered something extraordinary.',
      'Hidden beneath a loose floorboard was an ancient blueprint for a flying machine.',
      'The designs were unlike anything she had ever seen before, with intricate details and mysterious symbols.',
      'Maya knew she had to build it.',
      'She gathered materials from around the village and worked tirelessly for weeks.',
      'Finally, the day came to test her creation.',
      'With trembling hands, she climbed aboard and started the engine.',
      'The machine lifted gracefully into the sky, and Maya soared above the clouds for the very first time.'
    ]
  },
  {
    id: 'technical',
    title: 'Technical Explanation',
    description: 'Complex technical content with varied pacing',
    chunks: [
      'Welcome to today\'s session on distributed systems architecture.',
      'We\'ll start by examining the core principles of microservices design.',
      'First, let\'s consider the concept of service independence.',
      'Each microservice should own its data and business logic completely.',
      'This means avoiding shared databases between services whenever possible.',
      'Communication between services happens through well-defined APIs.',
      'Now, let\'s talk about handling failures in distributed systems.',
      'The circuit breaker pattern is essential for preventing cascade failures.',
      'When a service becomes unavailable, the circuit breaker opens automatically.',
      'This prevents upstream services from being overwhelmed by failed requests.',
      'Finally, monitoring and observability are crucial for production systems.',
      'You need comprehensive logging, metrics, and distributed tracing to understand system behavior.'
    ]
  }
];

export function getExampleById(id: string): ChunkExample | undefined {
  return chunkExamples.find(example => example.id === id);
}