document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const enableToggle = document.getElementById('enableDetection');
  const statusEl = document.getElementById('status');
  const testKeyBtn = document.getElementById('testKeyBtn');
  
  // Load saved settings
  chrome.storage.local.get(['geminiApiKey', 'detectorEnabled'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.detectorEnabled !== undefined) {
      enableToggle.checked = result.detectorEnabled;
    } else {
      // Default to true
      enableToggle.checked = true;
      chrome.storage.local.set({ detectorEnabled: true });
    }
  });

  // Save on input change
  let timeout;
  apiKeyInput.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      chrome.storage.local.set({ geminiApiKey: apiKeyInput.value.trim() }, () => {
        showStatus('Key saved!');
      });
    }, 500);
  });

  enableToggle.addEventListener('change', () => {
    chrome.storage.local.set({ detectorEnabled: enableToggle.checked }, () => {
      showStatus(enableToggle.checked ? 'Detection enabled' : 'Detection disabled');
      // Notify content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if(tabs[0] && tabs[0].url && tabs[0].url.includes("instagram.com")) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "toggleState", enabled: enableToggle.checked });
        }
      });
    });
  });

  testKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus('Please enter a key first', true);
      return;
    }
    
    testKeyBtn.textContent = 'Testing...';
    testKeyBtn.disabled = true;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'hello' }] }]
        })
      });
      
      if (response.ok) {
        showStatus('✅ Key is Valid!');
      } else {
        const errorData = await response.json();
        const shortError = errorData.error?.message || 'Invalid Key';
        showStatus('❌ ' + shortError, true);
      }
    } catch (err) {
      showStatus('❌ Network Error', true);
    }
    
    testKeyBtn.textContent = 'Test Key';
    testKeyBtn.disabled = false;
  });

  function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'status error' : 'status success';
    statusEl.style.display = 'block';
    setTimeout(() => {
      statusEl.style.display = 'none';
      statusEl.className = 'status';
    }, 4000);
  }
});
