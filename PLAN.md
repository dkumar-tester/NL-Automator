# NL-Automator Extension Plan

## Goal
Build a Chrome Extension that uses the built-in Prompt API (Gemini Nano) to translate natural language into browser actions (click, type, navigate, etc.).

## Architecture Overview

The extension consists of:
1.  **Popup UI**: Input for the user to type commands and status indicator.
2.  **Content Script**: To scrape the DOM, identify elements, and execute actions.
3.  **Prompt API Integration**: Communicating with `window.ai` or `chrome.aiOriginTrial.languageModel`.

## Context & Element Selection Strategy

### 1. DOM Context Representation
To enable the AI to understand the current page, we send a representation of the DOM. 

**Strategy**:
-   **Simplified DOM Tree**: Traverse the DOM and extract only interactive/semantic elements: `<a>`, `<button>`, `<input>`, `<textarea>`, `<select>`, `[role="button"]`.
-   **Attribute Extraction**: For each element, collect:
    -   `innerText` / `aria-label` / `placeholder`
    -   A unique data attribute (`data-nl-id`) for stable identification.
-   **Viewport Filtering**: Identify elements currently visible in the viewport to help the AI prioritize.

### 2. Prompting Logic
The prompt sent to the AI follows this structure:
-   **System Instruction**: "You are a browser automation assistant. Given the following list of interactive elements and a user command, return ONLY a JSON object representing the action to take."
-   **Output Format**: Strictly JSON: `{"elementId": number, "action": "click" | "type", "text": "string" (if type)}`.

### 3. Action Execution
Mapping the AI's JSON output to real browser events:
-   `click`: Trigger `element.click()`.
-   `type`: Focus element and set `value`, then dispatch input/change events.

## Security & Privacy
-   **On-Device Models**: The Prompt API runs locally via Gemini Nano, ensuring user data doesn't leave the browser.
-   **Permissions**: Minimal permissions for `activeTab`, `scripting`, and `storage`.
