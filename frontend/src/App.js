import React, { useState } from 'react';
import './App.css';

function App() {
  const [topic, setTopic] = useState('');
  const [videoLength, setVideoLength] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
            🔨 TubeSmith
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Craft viral YouTube videos with AI - Transform any topic into professional content
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Main Input Section */}
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-8 mb-8 border border-gray-700">
            {/* Topic Input */}
            <div className="mb-6">
              <label className="block text-white text-lg font-semibold mb-4">
                📝 Enter Your Video Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., 'AI revolution', 'space exploration'..."
                className="w-full p-4 text-lg rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                disabled={isGenerating}
              />
            </div>

            {/* Video Length Selector */}
            <div className="mb-6">
              <label className="block text-white text-lg font-semibold mb-4">
                ⏱️ Video Length (minutes)
              </label>
              <select
                value={videoLength}
                onChange={(e) => setVideoLength(parseInt(e.target.value))}
                className="w-full p-4 text-lg rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-purple-500 focus:outline-none appearance-none"
                disabled={isGenerating}
              >
                <option value={1}>1 (~150 words needed)</option>
                <option value={3}>3 (~450 words needed)</option>
                <option value={5}>5 (~750 words needed)</option>
                <option value={10}>10 (~1500 words needed)</option>
                <option value={15}>15 (~2250 words needed)</option>
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateFullVideo}
              disabled={isGenerating || !topic.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-lg text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? '🚀 Generating...' : `🎬 Create ${videoLength}-Min AI Video`}
            </button>
          </div>

          {/* Progress Display */}
          {currentStep && (
            <div className="bg-blue-900/30 backdrop-blur-sm rounded-xl p-6 mb-8 border border-blue-700">
              <div className="text-center">
                <p className="text-blue-300 text-lg font-semibold">{currentStep}</p>
                {isGenerating && (
                  <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generated Content Cards - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            
            {/* Script Card */}
            <div className={`bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 ${generatedContent.script ? '' : 'opacity-50'}`}>
              <h3 className="text-white text-lg font-semibold mb-2 flex items-center justify-center">
                {generatedContent.script ? '✅' : '⏳'} Script
              </h3>
              {generatedContent.script ? (
                <>
                  <p className="text-green-300 text-sm text-center mb-2">{generatedContent.script.word_count} words</p>
                  <p className="text-green-200 text-xs text-center">✓ Good length</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center">Waiting for generation...</p>
              )}
            </div>

            {/* Voice Card */}
            <div className={`bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 ${generatedContent.audio ? '' : 'opacity-50'}`}>
              <h3 className="text-white text-lg font-semibold mb-2 flex items-center justify-center">
                {generatedContent.audio ? '✅' : '⏳'} Voice
              </h3>
              {generatedContent.audio ? (
                <>
                  <p className="text-green-300 text-sm text-center mb-2">ElevenLabs AI</p>
                  <p className="text-green-200 text-xs text-center">Click for MP3</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center">Waiting for script...</p>
              )}
            </div>

            {/* Thumbnail Card */}
            <div className={`bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 ${generatedContent.thumbnail ? '' : 'opacity-50'}`}>
              <h3 className="text-white text-lg font-semibold mb-2 flex items-center justify-center">
                {generatedContent.thumbnail ? '✅' : '⏳'} Thumbnail
              </h3>
              {generatedContent.thumbnail ? (
                <>
                  <div className="mb-2">
                    <img 
                      src={`${BACKEND_URL}/${generatedContent.thumbnail.image_path}`}
                      alt="Generated thumbnail"
                      className="w-full h-20 object-cover rounded mx-auto"
                    />
                  </div>
                  <p className="text-green-300 text-sm text-center mb-2">DALL-E 3</p>
                  <p className="text-green-200 text-xs text-center">Click for PNG</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center">Waiting for generation...</p>
              )}
            </div>

            {/* Videos Card */}
            <div className={`bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 ${generatedContent.videos ? '' : 'opacity-50'}`}>
              <h3 className="text-white text-lg font-semibold mb-2 flex items-center justify-center">
                {generatedContent.videos ? '✅' : '⏳'} Videos
              </h3>
              {generatedContent.videos ? (
                <>
                  <p className="text-green-300 text-sm text-center mb-2">{generatedContent.videos.total_found} clips</p>
                  <p className="text-green-200 text-xs text-center">HD quality stock footage</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center">Waiting for generation...</p>
              )}
            </div>
          </div>

          {/* Integration Test Button */}
          <div className="text-center mb-8">
            <button
              onClick={testIntegrations}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-all"
            >
              🔧 Test AI Integrations
            </button>
          </div>

          {/* Test Results Display */}
          {testResults && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4">🧪 Integration Test Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(testResults).map(([service, result]) => (
                  <div key={service} className={`p-4 rounded-lg ${result.status === 'success' ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                    <h4 className="font-semibold text-white capitalize">{service}</h4>
                    <p className={`text-sm ${result.status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                      {result.status === 'success' ? '✅ Working' : '❌ Error'}
                    </p>
                    {result.error && <p className="text-xs text-red-200 mt-1">{result.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Downloads - appears when content is ready */}
          {(generatedContent.script || generatedContent.audio || generatedContent.thumbnail) && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4 flex items-center justify-center">
                📥 Quick Downloads
              </h3>
              <div className="flex justify-center gap-4">
                {generatedContent.script && (
                  <button
                    onClick={() => downloadFile('script', generatedContent.script.script_id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center gap-2"
                  >
                    📄 TXT
                  </button>
                )}
                {generatedContent.audio && (
                  <button
                    onClick={() => downloadFile('audio', generatedContent.audio.script_id)}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center gap-2"
                  >
                    🎵 MP3
                  </button>
                )}
                {generatedContent.thumbnail && (
                  <button
                    onClick={() => downloadFile('thumbnail', generatedContent.thumbnail.thumbnail_id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center gap-2"
                  >
                    🖼️ PNG
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completion Message */}
          {generatedContent.script && generatedContent.audio && generatedContent.thumbnail && generatedContent.videos && (
            <div className="bg-green-900/30 backdrop-blur-sm rounded-xl p-6 border border-green-700">
              <div className="text-center">
                <p className="text-green-300 text-xl font-semibold">✅ Complete YouTube video ready!</p>
                <p className="text-green-200 text-sm mt-2">Combining audio, visuals, and effects</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400">
          <p>🚀 Powered by OpenAI GPT-4, ElevenLabs, DALL-E & Pexels</p>
        </div>
      </div>
    </div>
  );
}

export default App;