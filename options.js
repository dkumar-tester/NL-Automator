// options.js: Manage multi-provider settings for NL-Automator

const providers = ['gemini', 'openai', 'xai'];

/**
 * Saves all settings to chrome.storage.local.
 * We store an object that includes the activeProvider and keys/models for each.
 */
function saveOptions() {
    const activeProvider = document.getElementById('activeProvider').value;

    const settings = {
        activeProvider: activeProvider,
        providers: {}
    };

    providers.forEach(p => {
        settings.providers[p] = {
            model: document.getElementById(`${p}Model`).value,
            key: document.getElementById(`${p}Key`).value
        };
    });

    chrome.storage.local.set(settings, () => {
        const status = document.getElementById('status');
        status.className = 'status-success';
        status.textContent = 'Settings saved successfully!';
        setTimeout(() => {
            status.className = '';
            status.textContent = '';
        }, 2000);
    });
}

/**
 * Restores settings from chrome.storage.local.
 */
function restoreOptions() {
    chrome.storage.local.get({
        activeProvider: 'gemini',
        providers: {
            gemini: { model: 'gemini-2.0-flash', key: '' },
            openai: { model: 'gpt-4o', key: '' },
            xai: { model: 'grok-2-latest', key: '' }
        }
    }, (items) => {
        document.getElementById('activeProvider').value = items.activeProvider;

        providers.forEach(p => {
            const pData = items.providers[p] || {};
            document.getElementById(`${p}Model`).value = pData.model || '';
            document.getElementById(`${p}Key`).value = pData.key || '';
        });
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
