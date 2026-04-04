# Eco Query

This project will help you combine the powers of a local LLM with a cloud LLM to give you a hybrid, efficient AI assistant experience. To get started, you will need to have a local LLM running.

## Step 1 - Setting up Ollama
*(Skip this step if you are already running a local LLM on Ollama)*
1. Download and install **Ollama** from [ollama.com](https://ollama.com/).
2. Open your terminal or command prompt.
3. Run the following command to download and start a local model (e.g., `llama3` or `phi3`):
   ```bash
   ollama run llama3
   ```
4. Ensure the Ollama background service is running on your system.

## Step 2 - Setting up the Extension
1. Open your Google Chrome browser and navigate to `chrome://extensions/`.
2. Enable **Developer mode** by toggling the switch in the top right corner.
3. Click on the **Load unpacked** button.
4. Select the root folder of this project (the directory containing the extension's `manifest.json` file).
![modeAndLoad image](assets/developerAndLoad.png)

## Step 3 - Usage (ChatGPT)
1. Go to [ChatGPT](https://chatgpt.com).
2. Write your query in the chat box, and the extension will automatically run and process it using the hybrid approach.

## Step 4 - Mode Selection
There is a mode selection feature available in the extension's popup interface.
1. Click on the Eco Query extension icon in your browser's extension toolbar.
2. You can switch between different modes to control how your queries are handled between local, cloud and Hybrid.

---

### Troubleshooting
**Known Bug:** If the extension is not actively working in ChatGPT:
- Try writing a simple query like *"hi"*.
- After receiving a response from ChatGPT, reload the page. This should re-initialize the extension correctly.
