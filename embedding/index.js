import { pipeline } from 'https://unpkg.com/@xenova/transformers@3.0.0';
let embedder = null;

// Load model once
async function loadModel() {
  if (!embedder) {
    document.getElementById("output").textContent = "Loading model... (first time only)";
    console.log("hlo");
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'
    );
    console.log("hi")

    document.getElementById("output").textContent = "Model loaded! Enter text.";
  }
}

// Generate embedding
async function generateEmbedding() {
  const text = document.getElementById("inputText").value;

  if (!text) {
    alert("Please enter some text");
    return;
  }

  await loadModel();

  document.getElementById("output").textContent = "Generating embedding...";

  const output = await embedder(text,{ pooling: 'mean', normalize: true });

  // Mean pooling
  const embedding = output[0].reduce((acc, val, i, arr) => {
    if (!acc.length) acc = new Array(val.length).fill(0);
    for (let j = 0; j < val.length; j++) {
      acc[j] += val[j] / arr.length;
    }
    return acc;
  }, []);

  document.getElementById("output").textContent =
    JSON.stringify(embedding.slice(0, 20), null, 2) +
    `\n\n... (${embedding.length} dimensions)`;
}

// Attach event AFTER DOM loads
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("clickButton")
    .addEventListener("click", generateEmbedding);

  // Optional preload
  loadModel();
});