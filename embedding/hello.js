import { pipeline } from '@xenova/transformers';

// Allocate a pipeline for sentiment-analysis
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// Compute sentence embeddings
const sentences = ['whatcapopaojjvfiajeiovioaevuhuhvohefuewbejivbiauhuhvuahvohhoehvoheuofhouhouehoahoovw'];
const output = await extractor(sentences, { pooling: 'mean', normalize: true });
console.log(output);