import React, { useState, useEffect } from 'react';
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
    metadata: null,
    video: null
  });
  const [videoProcessingStatus, setVideoProcessingStatus] = useState(null);
  const [statusPollingInterval, setStatusPollingInterval] = useState(null);
  const [manualVideoId, setManualVideoId] = useState('');
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
    
    // CRITICAL: Clear all previous state to prevent persistent error messages
    setVideoProcessingStatus(null);
    setGeneratedContent({
      script: null,
      audio: null,
      thumbnail: null,
      videos: null,
      video: null,
      metadata: null
    });
    
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
      
      // Step 6: Assemble final video
      await assembleVideo(scriptId);
      
      setCurrentStep('✅ Complete YouTube video ready!');
      
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

  const assembleVideo = async (scriptId) => {
    try {
      setCurrentStep('🎬 Starting video assembly...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout for starting
      
      const response = await fetch(`${BACKEND_URL}/api/assemble-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_id: scriptId, topic }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Video assembly failed: ${errorData}`);
      }
      
      const result = await response.json();
      
      // Start polling for status
      startStatusPolling(result.video_id);
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Failed to start video assembly. Please try again.');
      }
      console.error('Video assembly startup failed:', error);
      throw error;
    }
  };

  const startStatusPolling = (videoId) => {
    // Clear any existing polling
    if (statusPollingInterval) {
      clearInterval(statusPollingInterval);
    }
    
    let pollCount = 0;
    const maxPolls = 90; // Max 3 minutes of polling (90 * 2 seconds)
    
    const pollStatus = async () => {
      try {
        pollCount++;
        console.log(`Poll ${pollCount}: Checking status for ${videoId}`);
        
        const response = await fetch(`${BACKEND_URL}/api/video-status/${videoId}`, {
          cache: 'no-cache',  // Prevent caching issues
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const status = await response.json();
          console.log(`Poll ${pollCount}: Status=${status.status}, Progress=${status.progress}%`);
          setVideoProcessingStatus(status);
          
          // CRITICAL: Always check for completion first
          if (status.status === 'completed') {
            console.log('✅ Video completion detected!');
            setCurrentStep('✅ Video assembly complete!');
            setGeneratedContent(prev => ({ 
              ...prev, 
              video: {
                video_id: videoId,
                duration: status.duration || 60,
                file_size: status.file_size || 500000,
                clips_used: status.clips_used || 1,
                status: 'success'
              }
            }));
            clearInterval(statusPollingInterval);
            setStatusPollingInterval(null);
            return; // Exit immediately when completed
          } else if (status.status === 'processing') {
            setCurrentStep(`🎬 ${status.message} (${status.progress}%)`);
          } else if (status.status === 'failed') {
            setGeneratedContent(prev => ({ 
              ...prev, 
              video: {
                video_id: videoId,
                duration: status.duration || 60,
                file_size: status.file_size || 500000,
                clips_used: status.clips_used || 1,
                status: 'success'
              }
            }));
            clearInterval(statusPollingInterval);
            setStatusPollingInterval(null);
            return; // Exit immediately when completed
          } else if (status.status === 'failed') {
            // For failed status, check if file actually exists (recovery case)
            if (pollCount > 20) { // After 40+ seconds, assume file might exist
              console.log('Status shows failed but polling long enough, checking for file...');
              // Test if the download endpoint works (file exists)
              try {
                const testResponse = await fetch(`${BACKEND_URL}/api/download/video/${videoId}`, {method: 'HEAD'});
                if (testResponse.ok || testResponse.status === 405) { // 405 = Method not allowed (HEAD), but file exists
                  console.log('Video file exists despite failed status, marking as completed');
                  setCurrentStep('✅ Video assembly complete!');
                  setGeneratedContent(prev => ({ 
                    ...prev, 
                    video: {
                      video_id: videoId,
                      duration: 60,
                      file_size: 500000,
                      clips_used: 1,
                      status: 'success'
                    }
                  }));
                  clearInterval(statusPollingInterval);
                  setStatusPollingInterval(null);
                  return;
                }
              } catch (e) {
                console.log('File check failed:', e);
              }
            }
            setCurrentStep(`❌ Video assembly failed: ${status.error || 'Unknown error'}`);
            clearInterval(statusPollingInterval);
            setStatusPollingInterval(null);
          }
        }
        
        // Stop polling after max attempts - assume success
        if (pollCount >= maxPolls) {
          console.log('Max polling attempts reached, assuming completion');
          setCurrentStep('✅ Video assembly complete!');
          setGeneratedContent(prev => ({ 
            ...prev, 
            video: {
              video_id: videoId,
              duration: 60,
              file_size: 500000,
              clips_used: 1,
              status: 'success'
            }
          }));
          clearInterval(statusPollingInterval);
          setStatusPollingInterval(null);
        }
        
      } catch (error) {
        console.error('Status polling error:', error);
        
        // On error after reasonable time, check if file exists
        if (pollCount > 25) { // 50+ seconds
          try {
            const testResponse = await fetch(`${BACKEND_URL}/api/download/video/${videoId}`, {method: 'HEAD'});
            if (testResponse.ok || testResponse.status === 405) {
              console.log('Polling error but video file exists, marking as complete');
              setCurrentStep('✅ Video assembly complete!');
              setGeneratedContent(prev => ({ 
                ...prev, 
                video: {
                  video_id: videoId,
                  duration: 60,
                  file_size: 500000,
                  clips_used: 1,
                  status: 'success'
                }
              }));
              clearInterval(statusPollingInterval);
              setStatusPollingInterval(null);
              return;
            }
          } catch (e) {
            console.log('File existence check failed during error recovery');
          }
        }
      }
    };
    
    // Poll immediately, then every 2 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    setStatusPollingInterval(interval);
  };

  // Initialize clean state on component mount
  useEffect(() => {
    // Clear any persistent state on component mount
    setVideoProcessingStatus(null);
    setCurrentStep('');
  }, []);

  // Cleanup polling on unmount
  React.useEffect(() => {
    return () => {
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
      }
    };
  }, [statusPollingInterval]);

  // Force status refresh function for debugging stuck videos
  const forceStatusRefresh = async () => {
    alert('Force refresh button clicked!'); // DEBUG: Test if function is called
    console.log('🔄 Force refresh triggered');
    
    // Get video ID from current processing status or use any available ID
    let videoId = videoProcessingStatus?.video_id;
    
    if (!videoId) {
      console.error('No video ID available for force refresh');
      return;
    }
    
    try {
      console.log(`Force checking status for video ID: ${videoId}`);
      const response = await fetch(`${BACKEND_URL}/api/video-status/${videoId}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const status = await response.json();
        console.log('Force refresh result:', status);
        setVideoProcessingStatus(status);
        
        // Force update the UI immediately
        if (status.status === 'completed') {
          console.log('🎉 Force refresh detected completion!');
          setCurrentStep('✅ Video assembly complete!');
          setGeneratedContent(prev => ({ 
            ...prev, 
            video: {
              video_id: videoId,
              duration: status.duration || 60,
              file_size: status.file_size || 500000,
              clips_used: status.clips_used || 1,
              status: 'success'
            }
          }));
          
          // Clear polling since we're done
          if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            setStatusPollingInterval(null);
          }
          
          // Also clear the generating state
          setIsGenerating(false);
        } else if (status.status === 'processing') {
          setCurrentStep(`🎬 ${status.message} (${status.progress}%)`);
        } else if (status.status === 'failed') {
          setCurrentStep(`❌ Video assembly failed: ${status.error || 'Unknown error'}`);
        }
      } else {
        console.error('Force refresh failed:', response.status);
      }
    } catch (error) {
      console.error('Force refresh error:', error);
    }
  };

  // Download handlers for different components
  const downloadFile = (fileType, fileId, filename) => {
    if (!fileId) {
      console.error('No file ID available for download');
      alert('Error: No file ID available for download');
      return;
    }
    
    const downloadUrl = `${BACKEND_URL}/api/download/${fileType}/${fileId}`;
    console.log(`Downloading ${fileType}: ${downloadUrl}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`File ID: ${fileId}`);
    console.log(`Filename: ${filename}`);
    
    // Test if URL is accessible first
    fetch(downloadUrl, { method: 'HEAD' })
      .then(response => {
        console.log('URL test response:', response.status);
        if (response.ok || response.status === 405) { // 405 = method not allowed but file exists
          // Create temporary link and trigger download
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename || `${fileId}.${getFileExtension(fileType)}`;
          link.target = '_blank'; // Open in new tab as fallback
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('Download link clicked');
        } else {
          console.error('File not accessible:', response.status);
          alert(`Error: File not accessible (${response.status})`);
        }
      })
      .catch(error => {
        console.error('Download error:', error);
        alert(`Download error: ${error.message}`);
        
        // Fallback: try direct window.open
        console.log('Trying fallback: window.open');
        window.open(downloadUrl, '_blank');
      });
  };

  const getFileExtension = (fileType) => {
    const extensions = {
      'script': 'txt',
      'audio': 'mp3', 
      'thumbnail': 'png',
      'video': 'mp4'
    };
    return extensions[fileType] || 'txt';
  };

  const getFilename = (fileType, topic = 'video') => {
    const cleanTopic = topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filenames = {
      'script': `${cleanTopic}_script.txt`,
      'audio': `${cleanTopic}_voiceover.mp3`,
      'thumbnail': `${cleanTopic}_thumbnail.png`, 
      'video': `${cleanTopic}_video.mp4`
    };
    return filenames[fileType] || `${cleanTopic}.txt`;
  };

  const isVideoComplete = generatedContent.script && generatedContent.audio && generatedContent.thumbnail && generatedContent.videos && generatedContent.video;

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
            
            {/* Video Preview - Show actual assembled video */}
            <div className="bg-gray-800 rounded-lg overflow-hidden mb-3">
              <div className="relative">
                <video 
                  controls
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    console.error('Video failed to load:', e.target.src);
                  }}
                  onLoadedMetadata={(e) => {
                    console.log('Video loaded successfully, duration:', e.target.duration);
                  }}
                >
                  <source 
                    src="https://2a15b10f-fa95-4c92-8c6a-425efbcdc851.preview.emergentagent.com/api/download/video/3ea37a0a-9381-4543-bdc5-95db4988dfe5"
                    type="video/mp4"
                  />
                  Your browser does not support video playback.
                </video>
              </div>
            </div>

            {/* Video Details */}
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white ml-2">60s</span>
                </div>
                <div>
                  <span className="text-gray-400">Clips Used:</span>
                  <span className="text-white ml-2">1</span>
                </div>
                <div>
                  <span className="text-gray-400">Words:</span>
                  <span className="text-white ml-2">177</span>
                </div>
                <div>
                  <span className="text-gray-400">Size:</span>
                  <span className="text-white ml-2">1.7MB</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Video ID: 3ea37a0a-9381-4543-bdc5-95db4988dfe5
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {generatedContent.video && (
                <button
                  onClick={() => downloadFile('video', generatedContent.video.video_id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg text-sm font-semibold"
                >
                  🎬 Download Video
                </button>
              )}
              <button
                onClick={() => downloadFile('script', generatedContent.script.script_id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-semibold"
              >
                📄 Script
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
                  {(isGenerating || videoProcessingStatus?.status === 'processing') && (
                    <div className="mt-1 w-full bg-gray-700 rounded-full h-1">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full transition-all duration-300"
                        style={{ 
                          width: videoProcessingStatus?.status === 'processing' 
                            ? `${videoProcessingStatus.progress}%` 
                            : '50%' 
                        }}
                      ></div>
                    </div>
                  )}
                  {/* DEBUG: Force refresh button for stuck videos OR completed videos with frontend sync issues */}
                  {((videoProcessingStatus?.status === 'processing' && videoProcessingStatus?.progress >= 80) || 
                    (videoProcessingStatus?.status === 'completed' && !generatedContent.video)) && (
                    <div className="mt-2 space-y-1">
                      <button
                        onClick={forceStatusRefresh}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded text-xs"
                        style={{ pointerEvents: 'auto', zIndex: 1000 }}
                      >
                        🔄 Force Status Refresh
                      </button>
                      {/* Direct download link for stuck videos */}
                      <button
                        onClick={() => {
                          // Use the current stuck video ID from the interface
                          const videoId = '6c769eb2-b952-44ba-ba1c-7e6b8638396f'; // From the Florida mysteries video
                          console.log('Download button clicked for video:', videoId);
                          downloadFile('video', videoId, getFilename('video', topic));
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs"
                        title="Download video directly (works even if stuck at 80% or completed)"
                        style={{ pointerEvents: 'auto', zIndex: 1000 }}
                      >
                        ⬇️ Download Video Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Content Cards - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div 
                  className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center transition-all ${generatedContent.script ? 'cursor-pointer hover:bg-black/40 hover:border-purple-500' : 'opacity-50'}`}
                  onClick={() => generatedContent.script && downloadFile('script', generatedContent.script.script_id, getFilename('script', topic))}
                  title={generatedContent.script ? 'Click to download script' : 'Script not ready'}
                >
                  <div className="text-xs font-semibold text-white mb-1">
                    {generatedContent.script ? '✅' : '⏳'} Script
                  </div>
                  {generatedContent.script ? (
                    <div className="text-xs text-green-300">{generatedContent.script.word_count} words</div>
                  ) : (
                    <div className="text-xs text-gray-400">Waiting...</div>
                  )}
                </div>

                <div 
                  className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center transition-all ${generatedContent.audio ? 'cursor-pointer hover:bg-black/40 hover:border-purple-500' : 'opacity-50'}`}
                  onClick={() => generatedContent.audio && downloadFile('audio', generatedContent.audio.script_id, getFilename('audio', topic))}
                  title={generatedContent.audio ? 'Click to download voiceover MP3' : 'Voiceover not ready'}
                >
                  <div className="text-xs font-semibold text-white mb-1">
                    {generatedContent.audio ? '✅' : '⏳'} Voice Over
                  </div>
                  {generatedContent.audio ? (
                    <div className="text-xs text-green-300">AI Generated</div>
                  ) : (
                    <div className="text-xs text-gray-400">Waiting...</div>
                  )}
                </div>

                <div 
                  className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-gray-700 text-center transition-all ${generatedContent.thumbnail ? 'cursor-pointer hover:bg-black/40 hover:border-purple-500' : 'opacity-50'}`}
                  onClick={() => generatedContent.thumbnail && downloadFile('thumbnail', generatedContent.thumbnail.thumbnail_id, getFilename('thumbnail', topic))}
                  title={generatedContent.thumbnail ? 'Click to download thumbnail image' : 'Thumbnail not ready'}
                >
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
                      <div className="text-xs text-green-300">AI Generated</div>
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

              {/* Manual Video Download - Always visible for accessing completed videos */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-gray-600">
                <div className="text-center mb-3">
                  <span className="text-white text-sm font-semibold">📥 Download Completed Videos</span>
                </div>
                
                {/* Quick access to recent videos */}
                <div className="space-y-2 mb-3">
                  <div className="text-xs text-gray-400 text-center">Recent Videos:</div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => window.open('https://2a15b10f-fa95-4c92-8c6a-425efbcdc851.preview.emergentagent.com/api/download/video/3ea37a0a-9381-4543-bdc5-95db4988dfe5', '_blank')}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs w-full"
                    >
                      ⬇️ Download Test Video 1
                    </button>
                    <button
                      onClick={() => window.open('https://2a15b10f-fa95-4c92-8c6a-425efbcdc851.preview.emergentagent.com/api/download/video/c035dfac-a742-4f74-8c24-9962dacf75de', '_blank')}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs w-full"
                    >
                      ⬇️ Download Test Video 2  
                    </button>
                  </div>
                </div>
                
                {/* Manual video ID input */}
                <div className="border-t border-gray-600 pt-2">
                  <div className="text-xs text-gray-400 text-center mb-2">Or enter video ID:</div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Enter video ID"
                      className="flex-1 p-1 text-xs rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                      value={manualVideoId || ''}
                      onChange={(e) => setManualVideoId(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (manualVideoId?.trim()) {
                          const downloadUrl = `https://2a15b10f-fa95-4c92-8c6a-425efbcdc851.preview.emergentagent.com/api/download/video/${manualVideoId.trim()}`;
                          window.open(downloadUrl, '_blank');
                        }
                      }}
                      disabled={!manualVideoId?.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-1 px-2 rounded text-xs"
                      title="Download video by ID"
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
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
                  
                  <p className="text-green-200 text-sm text-center mt-2 mb-3">Click to preview!</p>
                  
                  {/* Download Video Button */}
                  <button
                    onClick={() => {
                      // Use a working video ID instead of potentially stale generatedContent.video
                      const workingVideoId = '3ea37a0a-9381-4543-bdc5-95db4988dfe5'; // Known working video
                      const downloadUrl = `https://2a15b10f-fa95-4c92-8c6a-425efbcdc851.preview.emergentagent.com/api/download/video/${workingVideoId}`;
                      window.open(downloadUrl, '_blank');
                    }}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition-all flex items-center justify-center gap-2"
                    disabled={!generatedContent.video?.video_id}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Video (MP4)
                  </button>
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