/**
 * ai-handler.js: Centralized AI logic for NL-Automator.
 * Contains the Universal System Prompt and message formatting for different providers.
 */

/* const SYSTEM_PROMPT = `You are a browser assistant. Based on the provided list of elements, return a JSON object with the action and the data-nl-id. 
Actions: 'click' or 'type'. 
If 'type', include a 'text' field.
Return ONLY valid JSON.`; */

const SYSTEM_PROMPT = `You are a professional browser automation agent. Your task is to analyze a list of interactive elements from a webpage and a user's natural language command to determine the single next logical action.

CONTEXT: You will receive a list of elements in JSON format, each containing a 'data-nl-id', 'tagName', and 'textContext'.

YOUR MISSION:

Identify the element that best matches the user's intent.

Determine if the action should be 'click' (for buttons/links) or 'type' (for input fields).

Return ONLY a valid JSON object. Do not include any explanations, markdown formatting, or preamble.

STRICT OUTPUT FORMAT:
{
"elementId": [The data-nl-id of the target element],
"action": "click" | "type",
"text": "[The text to type, if action is 'type', otherwise null]"
}

If you cannot find a matching element, return: {"error": "Element not found"}.`;

const AIHandler = {
    /**
     * constructRequestBody: Formats the request based on the provider.
     * @param {string} provider - 'gemini', 'openai', or 'xai'.
     * @param {string} model - The specific model name.
     * @param {Array} elements - Scanned page elements.
     * @param {string} userInput - The user's natural language command.
     * @returns {Object} - The request body for the fetch call.
     */
    constructRequestBody(provider, model, elements, userInput) {
        const userContent = `Here is the page map: ${JSON.stringify(elements)}. My command: ${userInput}`;

        if (provider === 'gemini') {
            return {
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: [
                    {
                        parts: [{ text: userContent }]
                    }
                ],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: "application/json"
                }
            };
        } else {
            // OpenAI and xAI use the standard Chat Completions format
            return {
                model: model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userContent }
                ],
                temperature: 0,
                response_format: { type: "json_object" }
            };
        }
    },

    /**
     * parseResponse: Extracts the JSON action from the AI response.
     * @param {string} provider - 'gemini', 'openai', or 'xai'.
     * @param {Object} data - The raw JSON response from the API.
     * @returns {Object} - The parsed action object.
     */
    parseResponse(provider, data) {
        let text = "";
        if (provider === 'gemini') {
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
            text = data.choices?.[0]?.message?.content || "";
        }

        // Clean up text to ensure it's valid JSON
        const jsonMatch = text.match(/\{.*\}/s);
        if (!jsonMatch) throw new Error("AI response did not contain a valid JSON action.");

        return JSON.parse(jsonMatch[0]);
    }
};
