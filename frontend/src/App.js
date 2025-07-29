import React, { useState } from 'react';
import './App.css';

function App() {
  const [topic, setTopic] = useState('');
  const [videoLength, setVideoLength] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [generatedContent, setGeneratedContent] = useState({
    script: null,
    audio: null,
    thumbnail: null,
    videos: null,
    metadata: null
  });
  const [testResults, setTestResults] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  const testIntegrations = async () => {
    try {
      setCurrentStep('Testing AI integrations...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
      
      const response = await fetch(`${BACKEND_URL}/api/test-integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Integration test failed: ${errorData}`);
      }
      
      const results = await response.json();
      setTestResults(results);
      setCurrentStep('Integration test completed');
    } catch (error) {
      if (error.name === 'AbortError') {
        setCurrentStep('Integration test timed out');
      } else {
        console.error('Integration test failed:', error);
        setCurrentStep('Integration test failed');
      }
    }
  };

  const generateScript = async () => {
    try {
      setCurrentStep('Generating AI script...');
      
      // Create AbortController for timeout handling - longer timeout for longer videos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minutes timeout
      
      const response = await fetch(`${BACKEND_URL}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, duration_minutes: videoLength }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Script generation failed: ${errorData}`);
      }
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, script: result }));
      return result.script_id;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Script generation timed out. Please try a shorter video duration or simpler topic.');
      }
      console.error('Script generation failed:', error);
      throw error;
    }
  };

  const generateVoice = async (scriptId) => {
    try {
      setCurrentStep('Generating AI voice-over...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
      
      const response = await fetch(`${BACKEND_URL}/api/generate-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_id: scriptId }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Voice generation failed: ${errorData}`);
      }
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, audio: result }));
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Voice generation timed out. Please try again.');
      }
      console.error('Voice generation failed:', error);
      throw error;
    }
  };

  const generateThumbnail = async () => {
    try {
      setCurrentStep('Creating AI thumbnail...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 1.5 minutes timeout
      
      const response = await fetch(`${BACKEND_URL}/api/generate-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Thumbnail generation failed: ${errorData}`);
      }
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, thumbnail: result }));
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Thumbnail generation timed out. Please try again.');
      }
      console.error('Thumbnail generation failed:', error);
      throw error;
    }
  };

  const getStockVideos = async () => {
    try {
      setCurrentStep('Finding stock videos...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
      
      const response = await fetch(`${BACKEND_URL}/api/get-stock-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: 10 }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Stock video search failed: ${errorData}`);
      }
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, videos: result }));
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Stock video search timed out. Please try again.');
      }
      console.error('Stock video search failed:', error);
      throw error;
    }
  };

  const generateMetadata = async (scriptContent) => {
    try {
      setCurrentStep('Generating YouTube optimization...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout
      
      const response = await fetch(`${BACKEND_URL}/api/generate-youtube-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, script_content: scriptContent }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Metadata generation failed: ${errorData}`);
      }
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, metadata: result }));
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Metadata generation timed out. Please try again.');
      }
      console.error('Metadata generation failed:', error);
      throw error;
    }
  };

  const generateFullVideo = async () => {
    if (!topic.trim()) {
      alert('Please enter a video topic');
      return;
    }

    setIsGenerating(true);
    setCurrentStep('Starting AI video generation...');
    
    try {
      // Step 1: Generate script
      const scriptId = await generateScript();
      
      // Step 2: Generate voice-over
      await generateVoice(scriptId);
      
      // Step 3: Generate thumbnail
      await generateThumbnail();
      
      // Step 4: Get stock videos
      await getStockVideos();
      
      // Step 5: Generate YouTube metadata
      await generateMetadata(generatedContent.script?.content || '');
      
      setCurrentStep('✅ AI video generation complete!');
      
    } catch (error) {
      console.error('Generation error:', error);
      setCurrentStep(`❌ ${error.message}`);
      
      // Clear the error message after 5 seconds to allow retry
      setTimeout(() => {
        setCurrentStep('');
      }, 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadFile = (fileType, fileId) => {
    const downloadUrl = `${BACKEND_URL}/api/download/${fileType}/${fileId}`;
    window.open(downloadUrl, '_blank');
  };

  const isVideoComplete = generatedContent.script && generatedContent.audio && generatedContent.thumbnail && generatedContent.videos;

  const handleThumbnailClick = () => {
    if (isVideoComplete) {
      setShowVideoPreview(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Video Preview Modal */}
      {showVideoPreview && isVideoComplete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 max-w-lg w-full border border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white text-lg font-bold">🎬 Your YouTube Video</h2>
              <button
                onClick={() => setShowVideoPreview(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            {/* Video Preview - Show thumbnail directly */}
            <div className="bg-gray-800 rounded-lg overflow-hidden mb-3">
              <div className="relative">
                <img 
                  src={generatedContent.thumbnail.image_url || `${BACKEND_URL}/${generatedContent.thumbnail.image_path}`}
                  alt="YouTube Video Thumbnail"
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    console.error('Thumbnail failed to load from:', e.target.src);
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div className="absolute inset-0 bg-black/30 hidden items-center justify-center">
                  <p className="text-white text-sm">Generated Thumbnail Preview</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-red-600/80 rounded-full p-3 hover:bg-red-600 transition-colors">
                    <div className="w-0 h-0 border-l-6 border-l-white border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Audio Player */}
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <h3 className="text-white text-sm font-semibold mb-2">🎙️ AI Voice-over</h3>
              <audio 
                controls 
                className="w-full h-8"
                preload="metadata"
                onError={(e) => {
                  console.error('Audio failed to load:', e.target.src);
                }}
                onLoadedMetadata={(e) => {
                  console.log('Audio loaded successfully:', e.target.duration);
                }}
              >
                <source 
                  src={`${BACKEND_URL}/generated_content/audio/${generatedContent.audio.script_id}.mp3`} 
                  type="audio/mpeg" 
                />
                <source 
                  src={`${BACKEND_URL}/api/download/audio/${generatedContent.audio.script_id}`} 
                  type="audio/mpeg" 
                />
                Your browser does not support audio playback.
              </audio>
              <p className="text-xs text-gray-400 mt-1">
                Audio ID: {generatedContent.audio.script_id}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => downloadFile('script', generatedContent.script.script_id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-semibold"
              >
                📄 Script
              </button>
              <button
                onClick={() => downloadFile('audio', generatedContent.audio.script_id)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-sm font-semibold"
              >
                🎵 Audio
              </button>
              <button
                onClick={() => downloadFile('thumbnail', generatedContent.thumbnail.thumbnail_id)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg text-sm font-semibold"
              >
                🖼️ Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="container mx-auto px-4 py-1">
        {/* Header - Minimal */}
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-white mb-1 bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
            🔨 TubeSmith
          </h1>
          <p className="text-sm text-gray-300">1-Click Content Creation</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Left Column - Input and Progress */}
            <div className="space-y-2">
              {/* Input Section - Minimal */}
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
                <div className="mb-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter video topic (e.g., 'AI revolution')"
                    className="w-full p-2 text-sm rounded-md bg-gray-800 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                    disabled={isGenerating}
                  />
                </div>
                <div className="mb-2">
                  <select
                    value={videoLength}
                    onChange={(e) => setVideoLength(parseInt(e.target.value))}
                    className="w-full p-2 text-sm rounded-md bg-gray-800 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                    disabled={isGenerating}
                  >
                    <option value={1}>1 minute (~150 words)</option>
                    <option value={3}>3 minutes (~450 words)</option>
                    <option value={5}>5 minutes (~750 words)</option>
                    <option value={10}>10 minutes (~1500 words)</option>
                  </select>
                </div>
                <button
                  onClick={generateFullVideo}
                  disabled={isGenerating || !topic.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? '🚀 Generating...' : `🎬 Create ${videoLength}-Min Video`}
                </button>
              </div>

              {/* Progress - Always Visible */}
              {currentStep && (
                <div className="bg-blue-900/30 backdrop-blur-sm rounded-lg p-2 border border-blue-700">
                  <p className="text-blue-300 text-sm font-semibold text-center">{currentStep}</p>
                  {isGenerating && (
                    <div className="mt-1 w-full bg-gray-700 rounded-full h-1">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              )}

              {/* Content Cards - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center ${generatedContent.script ? '' : 'opacity-50'}`}>
                  <div className="text-xs font-semibold text-white mb-1">
                    {generatedContent.script ? '✅' : '⏳'} Script
                  </div>
                  {generatedContent.script ? (
                    <div className="text-xs text-green-300">{generatedContent.script.word_count} words</div>
                  ) : (
                    <div className="text-xs text-gray-400">Waiting...</div>
                  )}
                </div>

                <div className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center ${generatedContent.audio ? '' : 'opacity-50'}`}>
                  <div className="text-xs font-semibold text-white mb-1">
                    {generatedContent.audio ? '✅' : '⏳'} Voice
                  </div>
                  {generatedContent.audio ? (
                    <div className="text-xs text-green-300">ElevenLabs AI</div>
                  ) : (
                    <div className="text-xs text-gray-400">Waiting...</div>
                  )}
                </div>

                <div className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center ${generatedContent.thumbnail ? '' : 'opacity-50'}`}>
                  <div className="text-xs font-semibold text-white mb-1">
                    {generatedContent.thumbnail ? '✅' : '⏳'} Thumbnail
                  </div>
                  {generatedContent.thumbnail ? (
                    <div>
                      <img 
                        src={generatedContent.thumbnail.image_url || `${BACKEND_URL}/${generatedContent.thumbnail.image_path}`}
                        alt="Thumbnail"
                        className="w-full h-8 object-cover rounded mb-1"
                      />
                      <div className="text-xs text-green-300">DALL-E 3</div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">Waiting...</div>
                  )}
                </div>

                <div className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center ${generatedContent.videos ? '' : 'opacity-50'}`}>
                  <div className="text-xs font-semibold text-white mb-1">
                    {generatedContent.videos ? '✅' : '⏳'} Videos
                  </div>
                  {generatedContent.videos ? (
                    <div className="text-xs text-green-300">{generatedContent.videos.total_found} clips</div>
                  ) : (
                    <div className="text-xs text-gray-400">Waiting...</div>
                  )}
                </div>
              </div>

              {/* Integration Test */}
              <div className="text-center">
                <button
                  onClick={testIntegrations}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md transition-all text-xs"
                >
                  🔧 Test Integrations
                </button>
              </div>

              {/* Test Results */}
              {testResults && (
                <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700">
                  <div className="grid grid-cols-3 gap-1">
                    {Object.entries(testResults).map(([service, result]) => (
                      <div key={service} className={`p-1 rounded text-center ${result.status === 'success' ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                        <div className="text-white text-xs font-semibold capitalize">{service}</div>
                        <div className={`text-xs ${result.status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                          {result.status === 'success' ? '✅' : '❌'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Completed Video */}
            <div className="flex items-start justify-center">
              {isVideoComplete ? (
                <div className="bg-green-900/30 backdrop-blur-sm rounded-lg p-4 border border-green-700 w-full max-w-sm">
                  <p className="text-green-300 text-lg font-semibold text-center mb-3">✅ Video Ready!</p>
                  
                  {/* Large Clickable Thumbnail */}
                  <div 
                    className="relative cursor-pointer group"
                    onClick={handleThumbnailClick}
                  >
                    <img 
                      src={generatedContent.thumbnail.image_url || `${BACKEND_URL}/${generatedContent.thumbnail.image_path}`}
                      alt="YouTube Video"
                      className="w-full h-40 object-cover rounded-md group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        console.error('Main thumbnail failed to load');
                        e.target.style.background = '#333';
                        e.target.alt = 'Thumbnail Loading...';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 rounded-md flex items-center justify-center group-hover:bg-black/30 transition-colors">
                      <div className="bg-red-600 rounded-full p-3 group-hover:scale-110 transition-transform">
                        <div className="w-0 h-0 border-l-6 border-l-white border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1"></div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-green-200 text-sm text-center mt-3">Click to preview!</p>
                </div>
              ) : (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-4 border border-gray-600 w-full max-w-sm">
                  <div className="text-center">
                    <div className="text-gray-400 text-4xl mb-2">🎬</div>
                    <p className="text-gray-400 text-sm">Your video will appear here when ready</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;