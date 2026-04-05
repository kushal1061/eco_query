// it will return embedding

import { pipeline } from '@xenova/transformers';

// Allocate a pipeline for sentiment-analysis
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

async function embeddings(text) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return output.data;
}
