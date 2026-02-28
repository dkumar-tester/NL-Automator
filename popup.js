/**
 * popup.js: The logic behind the extension's popup UI.
 * This script runs in the context of the extension's popup window.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const runBtn = document.getElementById('runBtn');
    const commandInput = document.getElementById('commandInput');
    const statusArea = document.getElementById('statusArea');

    // 1. Check if the Chrome Prompt API is available
    async function initModel() {
        try {
            // Note: window.ai is the experimental entry point for Gemini Nano in Chrome
            if (!window.ai || !window.ai.languageModel) {
                statusArea.textContent = "Status: Prompt API not found. Please check your Chrome flags.";
                runBtn.disabled = true;
                return null;
            }
            statusArea.textContent = "Status: Ready";
            return true;
        } catch (err) {
            statusArea.textContent = "Status: Error checking API";
            return null;
        }
    }

    await initModel();

    runBtn.addEventListener('click', async () => {
        const command = commandInput.value.trim();
        if (!command) return;

        statusArea.textContent = "Status: Analyzing page...";

        // 2. Identify the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 3. Inject logic into the page to find interactive elements
        // We use chrome.scripting.executeScript to run code on the actual website
        const [{ result: elements }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // This function runs INSIDE the webpage, not the popup
                const interactive = Array.from(document.querySelectorAll('button, input, a, [role="button"]'))
                    .filter(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0; // Only visible elements
                    })
                    .map((el, index) => {
                        // Tag each element so we can find it again later
                        el.setAttribute('data-nl-id', index.toString());
                        return {
                            id: index,
                            tag: el.tagName,
                            text: el.innerText || el.placeholder || el.ariaLabel || '',
                            type: el.type || ''
                        };
                    });
                return interactive;
            }
        });

        console.log("Scanned elements:", elements);
        statusArea.textContent = "Status: Asking AI...";

        try {
            // 4. Create a session with the local model
            const session = await window.ai.languageModel.create({
                systemPrompt: "You are a browser assistant. Based on the provided list of elements, return a JSON object with the action and the data-nl-id."
            });

            // 5. Send elements + command to the AI
            const prompt = `Elements: ${JSON.stringify(elements)}\nCommand: "${command}"`;
            const response = await session.prompt(prompt);

            // Clean up the response to find the JSON part
            const jsonPart = response.match(/\{.*\}/s);
            const action = JSON.parse(jsonPart ? jsonPart[0] : response);

            statusArea.textContent = `Status: Executing ${action.action}...`;

            // 6. Send a message to content.js to perform the action
            // Instead of injecting code, we send a message to the script already running on the page
            chrome.tabs.sendMessage(tab.id, {
                type: "PERFORM_ACTION",
                action: action
            }, (response) => {
                if (chrome.runtime.lastError) {
                    statusArea.textContent = "Status: Error - " + chrome.runtime.lastError.message;
                } else if (response && response.success) {
                    statusArea.textContent = "Status: Done!";
                } else {
                    statusArea.textContent = "Status: Failed - " + (response?.error || "Unknown error");
                }
            });
        } catch (err) {
            statusArea.textContent = "Status: AI Error - " + err.message;
        }
    });
});
