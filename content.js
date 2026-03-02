/**
 * content.js: The script that runs in the background of web pages.
 * Its main job is to listen for commands or manage the DOM on behalf of the extension.
 */

console.log("NL-Automator: Content script is monitoring the page.");

/**
 * HELPER: Find all buttons, inputs, and links, including those in Shadow DOM.
 */
function findAllInteractiveElements(root, selectors) {
    let elements = [];

    // 1. Check elements in the current root
    const nodes = root.querySelectorAll('*');
    nodes.forEach(node => {
        // Check if node matches selectors
        if (selectors.some(s => node.matches(s))) {
            elements.push(node);
        }

        // 2. Recursively check Shadow DOM
        if (node.shadowRoot) {
            elements = elements.concat(findAllInteractiveElements(node.shadowRoot, selectors));
        }
    });

    return elements;
}

function scanAndHighlight() {
    const selectors = [
        'button',
        'input',
        'a',
        '[role="button"]',
        'textarea',
        'select'
    ];

    // Find all matching elements including Shadow DOM
    const elements = findAllInteractiveElements(document, selectors);
    console.log(`NL-Automator: Found ${elements.length} interactive elements (including Shadow DOM).`);

    elements.forEach((el, index) => {
        // 1. Generate a unique ID if it doesn't have one
        // Use a prefix to avoid collisions if multiple frames run this
        const uniqueId = el.getAttribute('data-nl-id') || `nl-${window.location.host}-${index}`;
        el.setAttribute('data-nl-id', uniqueId);

        // 2. Log details to the console
        const text = el.innerText || el.placeholder || el.ariaLabel || el.value || 'No Text';
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
        const targetId = action["data-nl-id"] || action.elementId || action.id;

        // Find element by data-nl-id, including Shadow DOM
        function findByIdRecursive(root, id) {
            const selector = `[data-nl-id="${id}"]`;
            let el = root.querySelector(selector);
            if (el) return el;

            const nodes = root.querySelectorAll('*');
            for (const node of nodes) {
                if (node.shadowRoot) {
                    el = findByIdRecursive(node.shadowRoot, id);
                    if (el) return el;
                }
            }
            return null;
        }

        const el = findByIdRecursive(document, targetId);

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
