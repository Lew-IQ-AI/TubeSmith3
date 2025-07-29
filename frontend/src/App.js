import React, { useState } from 'react';
import './App.css';

function App() {
  const [topic, setTopic] = useState('');
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
      const response = await fetch(`${BACKEND_URL}/api/test-integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const results = await response.json();
      setTestResults(results);
      setCurrentStep('Integration test completed');
    } catch (error) {
      console.error('Integration test failed:', error);
      setCurrentStep('Integration test failed');
    }
  };

  const generateScript = async () => {
    try {
      setCurrentStep('Generating AI script...');
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
      
      const response = await fetch(`${BACKEND_URL}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, duration_minutes: 12 }),
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
        throw new Error('Script generation timed out. Please try again.');
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
      const response = await fetch(`${BACKEND_URL}/api/generate-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      
      if (!response.ok) throw new Error('Thumbnail generation failed');
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, thumbnail: result }));
      return result;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      throw error;
    }
  };

  const getStockVideos = async () => {
    try {
      setCurrentStep('Finding stock videos...');
      const response = await fetch(`${BACKEND_URL}/api/get-stock-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: 10 })
      });
      
      if (!response.ok) throw new Error('Stock video search failed');
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, videos: result }));
      return result;
    } catch (error) {
      console.error('Stock video search failed:', error);
      throw error;
    }
  };

  const generateMetadata = async (scriptContent) => {
    try {
      setCurrentStep('Generating YouTube optimization...');
      const response = await fetch(`${BACKEND_URL}/api/generate-youtube-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, script_content: scriptContent })
      });
      
      if (!response.ok) throw new Error('Metadata generation failed');
      
      const result = await response.json();
      setGeneratedContent(prev => ({ ...prev, metadata: result }));
      return result;
    } catch (error) {
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
      setCurrentStep(`❌ Error: ${error.message}`);
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
            Craft viral YouTube videos with AI - Transform any topic into professional content with script, voice-over, visuals, and thumbnails
          </p>
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

        {/* Main Input Section */}
        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-8 mb-8 border border-gray-700">
          <div className="max-w-2xl mx-auto">
            <label className="block text-white text-lg font-semibold mb-4">
              📝 Enter Your Video Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 'mysterious unsolved crimes', 'space exploration', 'ancient civilizations'..."
              className="w-full p-4 text-lg rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
              disabled={isGenerating}
            />
            <button
              onClick={generateFullVideo}
              disabled={isGenerating || !topic.trim()}
              className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-lg text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? '🚀 Generating...' : '🎬 Create AI Video'}
            </button>
          </div>
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

        {/* Generated Content Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Script Card */}
          {generatedContent.script && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                📜 AI Script Generated
              </h3>
              <p className="text-gray-300 mb-4">
                {generatedContent.script.word_count} words • Professional YouTube script
              </p>
              <div className="bg-gray-800 p-4 rounded-lg mb-4 max-h-40 overflow-y-auto">
                <p className="text-gray-300 text-sm">
                  {generatedContent.script.content.substring(0, 200)}...
                </p>
              </div>
              <button
                onClick={() => downloadFile('script', generatedContent.script.script_id)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-all"
              >
                📥 Download Script
              </button>
            </div>
          )}

          {/* Audio Card */}
          {generatedContent.audio && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                🎙️ AI Voice Generated
              </h3>
              <p className="text-gray-300 mb-4">
                High-quality ElevenLabs voice synthesis
              </p>
              <div className="bg-gray-800 p-4 rounded-lg mb-4">
                <p className="text-green-400 text-sm">✅ Voice generation complete</p>
              </div>
              <button
                onClick={() => downloadFile('audio', generatedContent.audio.script_id)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-all"
              >
                📥 Download Audio
              </button>
            </div>
          )}

          {/* Thumbnail Card */}
          {generatedContent.thumbnail && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                🖼️ AI Thumbnail Created
              </h3>
              <div className="mb-4">
                <img 
                  src={`${BACKEND_URL}/${generatedContent.thumbnail.image_path}`}
                  alt="Generated thumbnail"
                  className="w-full rounded-lg"
                />
              </div>
              <button
                onClick={() => downloadFile('thumbnail', generatedContent.thumbnail.thumbnail_id)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition-all"
              >
                📥 Download Thumbnail
              </button>
            </div>
          )}

          {/* Stock Videos Card */}
          {generatedContent.videos && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                🎥 Stock Videos Found
              </h3>
              <p className="text-gray-300 mb-4">
                {generatedContent.videos.total_found} relevant videos from Pexels
              </p>
              <div className="bg-gray-800 p-4 rounded-lg mb-4 max-h-40 overflow-y-auto">
                {generatedContent.videos.videos.slice(0, 3).map((video, index) => (
                  <p key={index} className="text-gray-300 text-sm mb-2">
                    📹 {video.duration}s - by {video.user}
                  </p>
                ))}
              </div>
              <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg transition-all">
                🎬 Preview Videos
              </button>
            </div>
          )}

          {/* YouTube Metadata Card */}
          {generatedContent.metadata && (
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                📊 YouTube SEO Generated
              </h3>
              <p className="text-gray-300 mb-4">
                Titles, description, tags & optimization
              </p>
              <div className="bg-gray-800 p-4 rounded-lg mb-4 max-h-40 overflow-y-auto">
                <p className="text-gray-300 text-sm">
                  {generatedContent.metadata.metadata.substring(0, 150)}...
                </p>
              </div>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-all">
                📥 Download Metadata
              </button>
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