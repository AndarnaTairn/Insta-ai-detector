// Maps element to its processed source URL to handle lazy loading
const processedElements = new WeakMap();
let isEnabled = true;

// Load initial state
chrome.storage.local.get(['detectorEnabled'], (result) => {
  if (result.detectorEnabled !== undefined) {
    isEnabled = result.detectorEnabled;
  }
});

// Listen for enabled state changes explicitly
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleState") {
    isEnabled = request.enabled;
    if (!isEnabled) {
      // Remove all elements if disabled
      document.querySelectorAll('.ai-detector-warning, .ai-detector-loading, .ai-detector-success, .ai-detector-error').forEach(el => el.remove());
      // Don't clear processedElements, so we don't re-process everything if toggled quickly, 
      // but actually if we disabled, we might want to rescan when enabled. 
      // Realistically we can just reload the page to get a fresh start or let it rescan.
    } else {
      scanDom();
    }
  }
});

function createLoadingElement() {
  const el = document.createElement('div');
  el.className = 'ai-detector-loading';
  el.innerHTML = '<div class="ai-detector-spinner"></div>AI Scan';
  return el;
}

function createWarningElement(confidence) {
  const el = document.createElement('div');
  el.className = 'ai-detector-warning';
  el.innerHTML = `⚠️ AI Generated (${confidence}%)`;
  return el;
}

function createSuccessElement(confidence) {
  const el = document.createElement('div');
  el.className = 'ai-detector-success';
  el.innerHTML = `✅ Real Image (${confidence}%)`;
  return el;
}

function createErrorElement(errorMsg) {
  const el = document.createElement('div');
  el.className = 'ai-detector-error';
  
  let displayMsg = 'Scan Failed';
  if (errorMsg) {
    el.title = errorMsg; // Full message on hover
    if (errorMsg.includes('API Key')) {
      displayMsg = 'Missing API Key';
    } else if (errorMsg.includes('Gemini API error: 400') || errorMsg.includes('Gemini API error: 403')) {
      displayMsg = 'Invalid API Key';
    } else if (errorMsg.includes('Gemini API error: 429')) {
      displayMsg = 'Rate Limited';
    } else if (errorMsg.includes('Gemini API error')) {
      displayMsg = 'API Error';
    } else if (errorMsg.includes('fetch image')) {
      displayMsg = 'Fetch Error';
    }
  }
  
  el.innerHTML = `❌ ${displayMsg}`;
  return el;
}

function processElement(el) {
  if (!isEnabled) return;
  
  let sourceUrl = '';
  if (el.nodeName === 'IMG') {
    sourceUrl = el.src;
  } else if (el.nodeName === 'VIDEO') {
    sourceUrl = el.poster; // Grab the static thumbnail
  }

  // Must be a valid HTTP url
  if (!sourceUrl || !sourceUrl.startsWith('http')) return;

  // We have already processed this exact URL for this specific element
  if (processedElements.get(el) === sourceUrl) return;

  // Mark this URL as processing for this element
  processedElements.set(el, sourceUrl);

  // Use a slight delay to allow the image to size and render in the DOM
  setTimeout(() => {
    // If element is no longer attached, skip
    if (!el.isConnected) return;

    const rect = el.getBoundingClientRect();
    if (rect.width < 150 || rect.height < 150) {
      // If it's too small, don't analyze it.
      // But we remove it from processed allowlist in case it resizes later (e.g. was hidden).
      processedElements.delete(el);
      return;
    }
    
    console.log(`Insta AI Detector - Checking ${el.nodeName.toLowerCase()}:`, sourceUrl);

    const parent = el.parentElement;
    if (!parent) return;

    // Mark parent relative if not already
    const computedStyle = window.getComputedStyle(parent);
    if (computedStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    // Clean up any existing loading/warning/success/error UI on THIS element's parent before adding new ones
    const existWarning = parent.querySelectorAll('.ai-detector-warning, .ai-detector-loading, .ai-detector-success, .ai-detector-error');
    existWarning.forEach(w => w.remove());

    const loadingEl = createLoadingElement();
    parent.appendChild(loadingEl);

    chrome.runtime.sendMessage({ action: "analyzeImage", url: sourceUrl }, (response) => {
      // Remove loading
      if (parent.contains(loadingEl)) {
        parent.removeChild(loadingEl);
      }

      if (response && response.error) {
        console.warn("Insta AI Detector Error:", response.error);
        const errorEl = createErrorElement(response.error);
        parent.appendChild(errorEl);
        // On error, let the user trigger it again if they want by clearing the map, 
        // or just leave it so we don't spam the API.
        return;
      }

      if (response && response.is_ai) {
        const warningEl = createWarningElement(response.confidence || 90);
        parent.appendChild(warningEl);
      } else if (response && response.is_ai === false) {
        const successEl = createSuccessElement(response.confidence || 90);
        parent.appendChild(successEl);
      }
    });
  }, 500);
}

function scanDom() {
  if (!isEnabled) return;
  document.querySelectorAll('img, video').forEach(processElement);
}

// Observe DOM for new images (infinite scroll and lazy loading)
const observer = new MutationObserver((mutations) => {
  if (!isEnabled) return;
  let shouldScan = false;
  mutations.forEach(mutation => {
    if (mutation.type === 'attributes' && (mutation.attributeName === 'src' || mutation.attributeName === 'poster')) {
      processElement(mutation.target);
    } else if (mutation.addedNodes.length) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === 'IMG' || node.nodeName === 'VIDEO') {
          processElement(node);
        } else if (node.querySelectorAll) {
          shouldScan = true;
        }
      });
    }
  });
  if (shouldScan) {
    scanDom();
  }
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true, 
  attributes: true, 
  attributeFilter: ['src', 'poster'] 
});

// Initial scan
setTimeout(scanDom, 1000); // Slight delay to let IG load
