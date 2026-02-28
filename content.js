/**
 * content.js: The script that runs in the background of web pages.
 * Its main job is to listen for commands or manage the DOM on behalf of the extension.
 */

console.log("NL-Automator: Content script is monitoring the page.");

/**
 * HELPER: Find all buttons, inputs, and links.
 * This is a utility function used to verify that the extension can "see" the page.
 * It adds a temporary blue border to each element for visual confirmation.
 */
function scanAndHighlight() {
    const selectors = [
        'button',
        'input',
        'a',
        '[role="button"]',
        'textarea',
        'select'
    ];

    // Find all matching elements
    const elements = document.querySelectorAll(selectors.join(','));
    console.log(`NL-Automator: Found ${elements.length} interactive elements.`);

    elements.forEach((el, index) => {
        // 1. Generate a unique ID if it doesn't have one
        const uniqueId = el.getAttribute('data-nl-id') || `nl-verify-${index}`;
        el.setAttribute('data-nl-id', uniqueId);

        // 2. Log details to the console
        const text = el.innerText || el.placeholder || el.ariaLabel || 'No Text';
        console.log(`[${uniqueId}] Tag: ${el.tagName}, Text: "${text}"`);

        // 3. Add a temporary thin blue border
        const originalOutline = el.style.outline;
        el.style.outline = '2px solid blue';
        el.style.outlineOffset = '2px';

        // 4. Remove the border after 3 seconds so it's not permanent
        setTimeout(() => {
            el.style.outline = originalOutline;
        }, 3000);
    });

    return elements.length;
}

// Automatically scan when the content script loads (for verification)
scanAndHighlight();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCAN_PAGE") {
        const count = scanAndHighlight();
        sendResponse({ count: count });
    } else if (request.type === "PERFORM_ACTION") {
        const action = request.action;
        const el = document.querySelector(`[data-nl-id="${action["data-nl-id"] || action.id}"]`);

        if (!el) {
            sendResponse({ success: false, error: "Element not found on page." });
            return;
        }

        try {
            if (action.action === 'click') {
                el.click();
                sendResponse({ success: true });
            } else if (action.action === 'type') {
                el.focus();
                el.value = action.text || '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: "Unsupported action type." });
            }
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
    }
    return true; // Keep the message channel open for async response
});
