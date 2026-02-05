// Jenifesto Background Script
// Handles message passing between content script and sidebar

console.log('Jenifesto background script loaded');

// Listen for messages from content script or sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type, 'from:', sender.url || 'extension');

  if (message.type === 'WIKIPEDIA_PAGE_LOADED') {
    // Store the current page data
    browser.storage.local.set({
      currentPage: {
        title: message.title,
        url: message.url,
        qid: message.qid,
        timestamp: Date.now()
      }
    });

    // Acknowledge receipt
    sendResponse({ success: true });
  }

  if (message.type === 'GET_CURRENT_PAGE') {
    // Sidebar requesting current page data
    browser.storage.local.get('currentPage').then(result => {
      sendResponse({ page: result.currentPage || null });
    });
    // Return true to indicate async response
    return true;
  }
});

// Log when extension is installed
browser.runtime.onInstalled.addListener((details) => {
  console.log('Jenifesto installed:', details.reason);
});
