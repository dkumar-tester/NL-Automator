/**
 * popup.js: The logic behind the extension's popup UI.
 * Multi-Provider Support: Gemini, OpenAI, and xAI (Grok).
 */

document.addEventListener('DOMContentLoaded', async () => {
    const runBtn = document.getElementById('runBtn');
    const commandInput = document.getElementById('commandInput');
    const statusArea = document.getElementById('statusArea');

    let activeSettings = {};

    /**
     * loadSettings: Retrieves multi-provider settings from chrome.storage.local.
     */
    async function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get({
                activeProvider: 'gemini',
                providers: {
                    gemini: { model: 'gemini-2.0-flash', key: '' },
                    openai: { model: 'gpt-4o', key: '' },
                    xai: { model: 'grok-2-latest', key: '' }
                }
            }, (items) => {
                const provider = items.activeProvider;
                activeSettings = {
                    provider: provider,
                    model: items.providers[provider]?.model,
                    key: items.providers[provider]?.key
                };

                if (!activeSettings.key) {
                    statusArea.innerHTML = `Status: <span style="color: #991b1b">Set API key for ${provider.toUpperCase()} in Options</span>`;
                    runBtn.disabled = true;
                } else {
                    statusArea.textContent = `Status: ${provider.toUpperCase()} (${activeSettings.model})`;
                    runBtn.disabled = false;
                }
                resolve(activeSettings);
            });
        });
    }

    await loadSettings();

    /**
     * callAI: Interacts with the selected provider using the AIHandler.
     */
    async function callAI(elements, userCommand) {
        let url = "";
        let headers = { "Content-Type": "application/json" };

        if (activeSettings.provider === 'gemini') {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${activeSettings.model}:generateContent?key=${activeSettings.key}`;
        } else {
            url = activeSettings.provider === 'openai'
                ? "https://api.openai.com/v1/chat/completions"
                : "https://api.x.ai/v1/chat/completions";
            headers["Authorization"] = `Bearer ${activeSettings.key}`;
        }

        // Use the centralized handler to bridge the gap between providers
        const body = AIHandler.constructRequestBody(
            activeSettings.provider,
            activeSettings.model,
            elements,
            userCommand
        );

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            try {
                const error = await response.json();
                errorMsg = error.error?.message || JSON.stringify(error);
            } catch (e) { /* response wasn't JSON */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        return AIHandler.parseResponse(activeSettings.provider, data);
    }

    runBtn.addEventListener('click', async () => {
        const command = commandInput.value.trim();
        if (!command) return;

        runBtn.disabled = true;
        statusArea.textContent = "Status: Analyzing page...";

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Get interactive elements
        const [{ result: elements }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return Array.from(document.querySelectorAll('button, input, a, [role="button"]'))
                    .filter(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    })
                    .map((el, index) => {
                        el.setAttribute('data-nl-id', index.toString());
                        return {
                            id: index,
                            tag: el.tagName,
                            text: el.innerText || el.placeholder || el.ariaLabel || '',
                            type: el.type || ''
                        };
                    });
            }
        });

        statusArea.textContent = `Status: Asking ${activeSettings.provider.toUpperCase()}...`;

        try {
            const action = await callAI(elements, command);
            statusArea.textContent = `Status: Executing ${action.action}...`;

            chrome.tabs.sendMessage(tab.id, {
                type: "PERFORM_ACTION",
                action: action
            }, (res) => {
                runBtn.disabled = false;
                if (chrome.runtime.lastError) {
                    statusArea.textContent = "Error: " + chrome.runtime.lastError.message;
                } else if (res && res.success) {
                    statusArea.textContent = "Status: Success!";
                } else {
                    statusArea.textContent = "Status: Failed - " + (res?.error || "Unknown error");
                }
            });

        } catch (err) {
            console.error(err);
            statusArea.textContent = "Status: AI Error - " + err.message;
            runBtn.disabled = false;
        }
    });
});
