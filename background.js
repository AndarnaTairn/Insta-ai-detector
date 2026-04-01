// Simple Memory Cache to save money and speed up identical images
const imageCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeImage") {
    handleImageAnalysis(request.url)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error("AI Analysis Error:", error);
        sendResponse({ error: error.message });
      });
    
    // Return true to indicate we will send response asynchronously
    return true; 
  }
});

async function handleImageAnalysis(imageUrl) {
  if (imageCache.has(imageUrl)) {
    return imageCache.get(imageUrl);
  }

  // Get API Key
  const storage = await chrome.storage.local.get(['geminiApiKey', 'detectorEnabled']);
  if (storage.detectorEnabled === false) return null;
  const apiKey = storage.geminiApiKey;
  
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Please set it in the extension popup.");
  }

  // Fetch the image data
  console.log("Fetching image:", imageUrl);
  let blob;
  try {
    const response = await fetch(imageUrl, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status} - Failed to fetch image`);
    blob = await response.blob();
  } catch (err) {
    throw new Error(`Failed to fetch image data: ${err.message}`);
  }

  // Convert and resize image using OffscreenCanvas to guarantee Claude compatibility and save tokens
  let processedBlob = blob;
  let mimeType = 'image/jpeg';
  try {
    const bmp = await self.createImageBitmap(blob);
    const maxDim = 1024;
    let width = bmp.width;
    let height = bmp.height;
    
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height / width) * maxDim);
        width = maxDim;
      } else {
        width = Math.round((width / height) * maxDim);
        height = maxDim;
      }
    }
    
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, width, height);
    
    processedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    
    // Release bitmap memory
    bmp.close();
  } catch (err) {
    console.warn("OffscreenCanvas resize failed, using original blob:", err);
    mimeType = blob.type;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
      mimeType = 'image/jpeg';
    }
  }

  const base64Data = await blobToBase64(processedBlob);

  // Call Gemini API
  const analysisResult = await analyzeWithGemini(apiKey, base64Data, mimeType);
  
  // Cache the result to save costs
  imageCache.set(imageUrl, analysisResult);
  
  return analysisResult;
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 1024 * 32;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function analyzeWithGemini(apiKey, base64Data, mediaType) {
  const prompt = `Analyze this image carefully. Is it AI-generated? Look for tells like structural inconsistencies, nonsensical text, unnatural textures, merged objects, or distorted anatomy. Reply ONLY with a valid JSON strictly following this format: {"is_ai": true, "confidence": 95} or {"is_ai": false, "confidence": 90}. Do not include markdown, explanations, or any other text.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mediaType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("API Error Response:", errorBody);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  console.log("Gemini Raw Response:", rawText);
  
  try {
    // Extract JSON in case Gemini added markdown or intro text
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error("Could not find JSON in response");
    
    const result = JSON.parse(jsonMatch[0]);
    return {
      is_ai: result.is_ai,
      confidence: result.confidence
    };
  } catch (err) {
    throw new Error(`Failed to parse Gemini response: ${err.message}`);
  }
}
