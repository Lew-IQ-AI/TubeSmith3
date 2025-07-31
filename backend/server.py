from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
import uuid
from typing import Optional
from pydantic import BaseModel
import openai
import requests
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
import aiofiles
from dotenv import load_dotenv
import asyncio
import threading
import json
import time
import tempfile
import shutil
from pathlib import Path

# Load environment variables
load_dotenv()

app = FastAPI()

# Startup event to clear any cached error states
@app.on_event("startup")
async def startup_event():
    clear_video_status()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI clients
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')
PEXELS_API_KEY = os.getenv('PEXELS_API_KEY')

# Initialize OpenAI client
openai_client = openai.OpenAI(
    api_key=OPENAI_API_KEY,
    timeout=120  # 2 minutes timeout
)

# Initialize ElevenLabs client
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

# Create directories for file storage
os.makedirs("generated_content", exist_ok=True)
os.makedirs("generated_content/scripts", exist_ok=True)
os.makedirs("generated_content/audio", exist_ok=True)
os.makedirs("generated_content/thumbnails", exist_ok=True)
os.makedirs("generated_content/videos", exist_ok=True)
os.makedirs("generated_content/status", exist_ok=True)
os.makedirs("generated_content/temp_videos", exist_ok=True)

# Mount static files
app.mount("/generated_content", StaticFiles(directory="generated_content"), name="generated_content")

class VideoRequest(BaseModel):
    topic: str
    duration_minutes: Optional[int] = 12

class VideoResponse(BaseModel):
    video_id: str
    status: str
    message: str

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "AI YouTube Generator API is running"}

@app.post("/api/test-integrations")
async def test_ai_integrations():
    """Test all AI service integrations"""
    results = {}
    
    # Test OpenAI
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'OpenAI integration working!'"}],
            max_tokens=10
        )
        results["openai"] = {"status": "success", "response": response.choices[0].message.content}
    except Exception as e:
        results["openai"] = {"status": "error", "error": str(e)}
    
    # Test ElevenLabs
    try:
        # Test text-to-speech instead of voices list (doesn't require voices_read permission)
        audio = elevenlabs_client.text_to_speech.convert(
            voice_id="pNInz6obpgDQGcFmaJgB",  # Adam voice ID
            text="ElevenLabs integration test",
            output_format="mp3_22050_32"
        )
        # Just check if we can create the audio object without saving
        audio_data = b"".join(audio)
        results["elevenlabs"] = {"status": "success", "audio_bytes": len(audio_data)}
    except Exception as e:
        results["elevenlabs"] = {"status": "error", "error": str(e)}
    
    # Test Pexels
    try:
        headers = {"Authorization": PEXELS_API_KEY}
        response = requests.get("https://api.pexels.com/v1/search?query=test&per_page=1", headers=headers)
        if response.status_code == 200:
            results["pexels"] = {"status": "success", "photos_found": len(response.json().get("photos", []))}
        else:
            results["pexels"] = {"status": "error", "error": f"HTTP {response.status_code}"}
    except Exception as e:
        results["pexels"] = {"status": "error", "error": str(e)}
    
    return results

@app.post("/api/generate-script")
async def generate_script(request: VideoRequest):
    """Generate a YouTube video script using OpenAI GPT-4"""
    try:
        # Calculate word target based on duration (approximately 150 words per minute)
        word_target = max(150, request.duration_minutes * 150)
        
        prompt = f"""
        Create a compelling, engaging YouTube video script about "{request.topic}" that will be exactly {request.duration_minutes} minutes long.
        
        Requirements:
        - Write approximately {word_target} words ({request.duration_minutes} minutes of content)
        - Include a strong hook in the first 15 seconds
        - Use storytelling techniques to maintain engagement
        - Write in a conversational, engaging tone for voiceover narration
        - Include call-to-action at the end
        
        CRITICAL: Write ONLY the spoken narration text. Do NOT include:
        - Stage directions (setup, fade in, fade out, cut to, etc.)
        - Technical instructions (zoom in, close-up, pan to, etc.)
        - Video editing notes (transition, overlay, graphics, etc.)
        - Camera directions (wide shot, medium shot, etc.)
        - Any text that is not meant to be spoken aloud
        
        Format requirements:
        - Use natural speech patterns and pauses
        - Write complete sentences that flow naturally when spoken
        - Avoid brackets, parentheses, or special formatting
        - Make it sound natural for AI voice generation
        
        Topic: {request.topic}
        Duration: {request.duration_minutes} minutes
        
        Generate ONLY the spoken script content - nothing else.
        """
        
        # Use different models based on content length for better performance
        model = "gpt-4o-mini" if request.duration_minutes <= 5 else "gpt-4o"
        max_tokens = min(4000, word_target + 500)  # Dynamic token limit
        timeout = min(180, 30 + (request.duration_minutes * 10))  # Dynamic timeout
        
        response = openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.7,
            timeout=timeout
        )
        
        script_content = response.choices[0].message.content
        script_id = str(uuid.uuid4())
        
        # Save script to file
        script_path = f"generated_content/scripts/{script_id}.txt"
        async with aiofiles.open(script_path, 'w') as f:
            await f.write(script_content)
        
        return {
            "script_id": script_id,
            "content": script_content,
            "word_count": len(script_content.split()),
            "estimated_duration": request.duration_minutes,
            "file_path": script_path
        }
        
    except openai.APITimeoutError:
        raise HTTPException(status_code=408, detail=f"Script generation timed out for {request.duration_minutes}-minute video. Try reducing the duration or simplifying the topic.")
    except openai.APIError as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

@app.post("/api/generate-voice")
async def generate_voice(request: dict):
    """Convert script to voice using ElevenLabs"""
    try:
        script_id = request.get("script_id")
        if not script_id:
            raise HTTPException(status_code=400, detail="script_id is required")
            
        # Read script file
        script_path = f"generated_content/scripts/{script_id}.txt"
        if not os.path.exists(script_path):
            raise HTTPException(status_code=404, detail="Script not found")
        
        async with aiofiles.open(script_path, 'r') as f:
            script_content = await f.read()
        
        # Clean script for voice synthesis (remove markers)
        clean_script = script_content.replace('[TIMESTAMP:', '').replace('[PAUSE]', '... ').replace('[EMPHASIS]', '').replace(']', '')
        
        # Generate voice using ElevenLabs with text-to-speech
        audio = elevenlabs_client.text_to_speech.convert(
            voice_id="pNInz6obpgDQGcFmaJgB",  # Adam voice ID
            optimize_streaming_latency="0",
            output_format="mp3_22050_32",
            text=clean_script,
            voice_settings=VoiceSettings(
                stability=0.71,
                similarity_boost=0.5,
                style=0.0,
                use_speaker_boost=True
            )
        )
        
        # Save audio file
        audio_path = f"generated_content/audio/{script_id}.mp3"
        with open(audio_path, 'wb') as f:
            for chunk in audio:
                f.write(chunk)
        
        return {
            "script_id": script_id,
            "audio_path": audio_path,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice generation failed: {str(e)}")

@app.post("/api/generate-thumbnail")
async def generate_thumbnail(request: dict):
    """Generate thumbnail using DALL-E"""
    try:
        topic = request.get("topic", "")
        prompt = f"""
        Create a highly engaging, professional YouTube thumbnail image for a video about "{topic}".
        
        CRITICAL REQUIREMENTS:
        - NO TEXT OR WORDS in the image at all
        - NO letters, numbers, or written content
        - Focus on powerful visual imagery only
        - Dramatic, cinematic composition
        - High contrast and vibrant colors
        - Professional photography style
        - Should evoke strong emotion and curiosity
        - Optimized for YouTube thumbnail format
        - Dark, mysterious atmosphere if the topic is serious
        - Bright, energetic if the topic is upbeat
        
        Style: Professional digital art, photorealistic, movie poster quality, no text overlay.
        """
        
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="standard",
            n=1,
        )
        
        # Download and save the image
        image_url = response.data[0].url
        thumbnail_id = str(uuid.uuid4())
        
        img_response = requests.get(image_url, timeout=30)
        thumbnail_path = f"generated_content/thumbnails/{thumbnail_id}.png"
        
        with open(thumbnail_path, 'wb') as f:
            f.write(img_response.content)
        
        return {
            "thumbnail_id": thumbnail_id,
            "image_path": thumbnail_path,
            "image_url": image_url
        }
        
    except openai.APITimeoutError:
        raise HTTPException(status_code=408, detail="Thumbnail generation timed out. Please try again.")
    except openai.APIError as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Thumbnail generation failed: {str(e)}")

@app.post("/api/get-stock-videos")
async def get_stock_videos(request: dict):
    """Get stock videos from Pexels"""
    try:
        topic = request.get("topic", "")
        count = request.get("count", 10)
        
        headers = {"Authorization": PEXELS_API_KEY}
        
        # Search for videos related to the topic
        search_url = f"https://api.pexels.com/videos/search?query={topic}&per_page={count}&size=medium"
        response = requests.get(search_url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Pexels API error: {response.status_code}")
        
        data = response.json()
        videos = []
        
        for video in data.get('videos', []):
            # Get the medium quality video file
            video_files = video.get('video_files', [])
            medium_quality = next((vf for vf in video_files if vf.get('quality') == 'hd'), video_files[0] if video_files else None)
            
            if medium_quality:
                videos.append({
                    "id": video['id'],
                    "url": medium_quality['link'],
                    "duration": video.get('duration', 0),
                    "tags": video.get('tags', []),
                    "user": video.get('user', {}).get('name', 'Unknown')
                })
        
        return {"videos": videos, "total_found": len(videos)}
        
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Network error accessing Pexels: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stock video search failed: {str(e)}")

@app.post("/api/generate-youtube-metadata")
async def generate_youtube_metadata(request: dict):
    """Generate YouTube title, description, and tags"""
    try:
        topic = request.get("topic", "")
        script_content = request.get("script_content", "")
        
        prompt = f"""
        Create optimized YouTube metadata for a video about "{topic}".
        
        Generate:
        1. 3 high-CTR title variations (60 characters max each)
        2. A detailed description (200+ words) with:
           - Engaging opening
           - Key points covered
           - Relevant hashtags
           - Call to action
        3. 10-15 relevant tags for YouTube SEO
        
        Make it optimized for YouTube algorithm and high engagement.
        Script preview: {script_content[:200]}...
        """
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.7,
            timeout=30
        )
        
        metadata = response.choices[0].message.content
        
        return {
            "topic": topic,
            "metadata": metadata,
            "generated_at": str(uuid.uuid4())
        }
        
    except openai.APITimeoutError:
        raise HTTPException(status_code=408, detail="Metadata generation timed out. Please try again.")
    except openai.APIError as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metadata generation failed: {str(e)}")

# Video processing status tracking - clear on startup
video_status = {}

def clear_video_status():
    """Clear all video status on startup - both memory and persistent files"""
    global video_status
    video_status = {}
    
    # Also clear persistent status files that contain old errors
    import os, glob
    status_files = glob.glob("generated_content/status/*.json")
    for file_path in status_files:
        try:
            os.remove(file_path)
        except:
            pass
    
    print(f"Video status cache cleared on startup: {len(status_files)} persistent files removed")

def update_video_status(video_id: str, status: str, progress: int = 0, message: str = "", error: str = ""):
    """Update video processing status"""
    video_status[video_id] = {
        "status": status,  # "processing", "completed", "failed"
        "progress": progress,  # 0-100
        "message": message,
        "error": error,
        "timestamp": time.time()
    }
    
    # Also save to file for persistence
    status_file = f"generated_content/status/{video_id}.json"
    try:
        os.makedirs(os.path.dirname(status_file), exist_ok=True)
        with open(status_file, 'w') as f:
            json.dump(video_status[video_id], f)
    except Exception as e:
        print(f"Failed to save status: {e}")

def process_video_background(video_id: str, script_id: str, topic: str):
    """Background video processing function - creates actual MP4 video from thumbnail + audio"""
    try:
        print(f"Starting background video processing for {video_id}")
        update_video_status(video_id, "processing", 10, "Starting video assembly...")
        
        # Check required files
        script_path = f"generated_content/scripts/{script_id}.txt"
        audio_path = f"generated_content/audio/{script_id}.mp3"
        
        if not os.path.exists(script_path) or not os.path.exists(audio_path):
            update_video_status(video_id, "failed", 0, "", "Required files not found")
            return
        
        # Find the corresponding thumbnail (same script_id pattern)
        import glob
        thumbnail_pattern = f"generated_content/thumbnails/*.png"
        thumbnail_files = glob.glob(thumbnail_pattern)
        
        if not thumbnail_files:
            update_video_status(video_id, "failed", 0, "", "No thumbnail found for video creation")
            return
        
        # Use the most recent thumbnail
        thumbnail_path = max(thumbnail_files, key=os.path.getctime)
        
        update_video_status(video_id, "processing", 30, "Getting stock video clips...")
        
        # Get stock videos from Pexels for this topic
        stock_videos = []
        try:
            import requests
            headers = {"Authorization": os.environ.get('PEXELS_API_KEY')}
            search_url = f"https://api.pexels.com/videos/search?query={topic}&per_page=5&size=medium"
            response = requests.get(search_url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                for video in data.get('videos', [])[:3]:  # Get top 3 videos
                    video_files = video.get('video_files', [])
                    # Get medium quality video
                    medium_quality = next((vf for vf in video_files if vf.get('quality') == 'hd'), 
                                        video_files[0] if video_files else None)
                    
                    if medium_quality and medium_quality.get('link'):
                        stock_videos.append({
                            'url': medium_quality['link'],
                            'duration': video.get('duration', 10),
                            'id': video['id']
                        })
                        
                print(f"Found {len(stock_videos)} stock videos for topic: {topic}")
            else:
                print(f"Pexels API error: {response.status_code}")
                
        except Exception as e:
            print(f"Error fetching stock videos: {e}")
            stock_videos = []
        
        update_video_status(video_id, "processing", 60, "Downloading and processing stock videos...")
        
        # Get audio duration using a simple approach
        try:
            import subprocess
            duration_cmd = ['/usr/bin/ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', 
                          '-of', 'default=noprint_wrappers=1:nokey=1', audio_path]
            print(f"Getting audio duration with command: {' '.join(duration_cmd)}")
            duration_result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=10, cwd="/app/backend")
            print(f"FFprobe result: stdout='{duration_result.stdout}', stderr='{duration_result.stderr}', returncode={duration_result.returncode}")
            audio_duration = float(duration_result.stdout.strip()) if duration_result.stdout.strip() else 60.0
        except Exception as e:
            print(f"Error getting audio duration: {e}")
            # Fallback: assume reasonable duration
            audio_duration = 60.0
        
        print(f"Audio duration: {audio_duration} seconds")
        
        # Create final video output path
        output_path = f"generated_content/videos/{video_id}.mp4"
        
        # Create video directory for temporary files
        temp_video_dir = f"generated_content/temp_videos/{video_id}"
        os.makedirs(temp_video_dir, exist_ok=True)
        
        try:
            if stock_videos and len(stock_videos) > 0:
                # OPTION 1: Use stock video clips (dynamic video)
                print("Creating dynamic video with stock footage...")
                update_video_status(video_id, "processing", 50, "Downloading stock video clips...")
                
                # Download stock video clips
                downloaded_clips = []
                total_clip_duration = 0
                
                for i, stock_video in enumerate(stock_videos):
                    try:
                        clip_path = f"{temp_video_dir}/clip_{i}.mp4"
                        
                        # Download the video clip
                        import requests
                        clip_response = requests.get(stock_video['url'], timeout=60)
                        if clip_response.status_code == 200:
                            with open(clip_path, 'wb') as f:
                                f.write(clip_response.content)
                            
                            # Get actual duration of downloaded clip
                            try:
                                dur_cmd = ['/usr/bin/ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', 
                                         '-of', 'default=noprint_wrappers=1:nokey=1', clip_path]
                                dur_result = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=10)
                                clip_duration = float(dur_result.stdout.strip()) if dur_result.stdout.strip() else 10.0
                            except:
                                clip_duration = min(stock_video.get('duration', 10), 20)  # Max 20 seconds per clip
                            
                            downloaded_clips.append({
                                'path': clip_path,
                                'duration': clip_duration
                            })
                            total_clip_duration += clip_duration
                            
                            print(f"Downloaded clip {i}: {clip_duration}s")
                            
                            # Stop if we have enough duration
                            if total_clip_duration >= audio_duration:
                                break
                                
                    except Exception as e:
                        print(f"Error downloading clip {i}: {e}")
                        continue
                
                if downloaded_clips and len(downloaded_clips) >= 1:
                    # Create video from stock clips + audio
                    update_video_status(video_id, "processing", 70, "Creating dynamic video with stock clips...")
                    
                    # Create FFmpeg input list with absolute paths
                    clips_list_path = f"{temp_video_dir}/clips_list.txt"
                    with open(clips_list_path, 'w') as f:
                        for clip in downloaded_clips:
                            absolute_path = os.path.abspath(clip['path'])
                            f.write(f"file '{absolute_path}'\n")
                    
                    # Create dynamic video with stock clips + audio
                    ffmpeg_cmd = [
                        '/usr/bin/ffmpeg', '-y',
                        '-f', 'concat',
                        '-safe', '0',
                        '-i', clips_list_path,          # Video clips (concatenated)
                        '-i', audio_path,               # Audio track
                        '-c:v', 'libx264',              # Re-encode video to fix timestamps
                        '-c:a', 'aac',                  # Audio codec
                        '-preset', 'fast',              # Faster for ARM64
                        '-crf', '28',                   # Good quality/size balance
                        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black',
                        '-t', str(audio_duration),      # Limit to audio duration
                        '-avoid_negative_ts', 'make_zero',  # Fix timestamp issues
                        '-fflags', '+genpts',           # Generate presentation timestamps
                        '-movflags', '+faststart',      # Web streaming optimization
                        '-max_muxing_queue_size', '1024', # Handle ARM64 processing delays
                        output_path
                    ]
                    
                    print(f"Creating dynamic video with {len(downloaded_clips)} clips using FFmpeg...")
                    update_video_status(video_id, "processing", 80, "Assembling dynamic video...")
                    
                else:
                    # Fallback to static thumbnail if no clips downloaded
                    print("No stock clips available, using static thumbnail...")
                    raise Exception("No stock clips downloaded successfully")
                    
            else:
                raise Exception("No stock videos found from Pexels")
                
        except Exception as e:
            # OPTION 2: Fallback to static thumbnail + audio
            print(f"Falling back to static video due to: {e}")
            update_video_status(video_id, "processing", 80, "Creating static video with thumbnail...")
            
            # Create video using static thumbnail as fallback
            ffmpeg_cmd = [
                '/usr/bin/ffmpeg', '-y',  # Overwrite output file (use full path)
                '-loop', '1',    # Loop the image
                '-i', thumbnail_path,  # Input image
                '-i', audio_path,      # Input audio
                '-c:v', 'libx264',     # Video codec
                '-c:a', 'aac',         # Use AAC for better compatibility
                '-preset', 'fast',     # Faster encoding for ARM64
                '-crf', '28',          # Good quality/size balance
                '-r', '25',            # Standard frame rate for better playback
                '-pix_fmt', 'yuv420p', # Compatible pixel format
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black', # Better scaling with black padding
                '-shortest',           # Stop when shortest stream ends
                '-movflags', '+faststart', # Enable web streaming
                '-max_muxing_queue_size', '1024', # Handle ARM64 processing delays
                output_path
            ]
            
            update_video_status(video_id, "processing", 80, "Rendering final video...")
            
            print(f"Starting FFmpeg with command: {' '.join(ffmpeg_cmd)}")
            print(f"Working directory: {os.getcwd()}")
            print(f"FFmpeg path exists: {os.path.exists('/usr/bin/ffmpeg')}")
            
            # Run FFmpeg with extended timeout for ARM64 architecture (video processing needs more time)
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=600, cwd="/app/backend")  # 10 minutes
            
            print(f"FFmpeg completed with return code: {result.returncode}")
            if result.stdout:
                print(f"FFmpeg stdout: {result.stdout[:200]}...")
            if result.stderr:
                print(f"FFmpeg stderr: {result.stderr[:200]}...")
            
            if result.returncode != 0:
                print(f"FFmpeg failed with error: {result.stderr}")
                update_video_status(video_id, "failed", 0, "", f"Video rendering failed: {result.stderr[:100]}")
                return
            
            print(f"FFmpeg succeeded, checking output file: {output_path}")
            
        except subprocess.TimeoutExpired:
            print("FFmpeg process timed out")
            update_video_status(video_id, "failed", 0, "", "Video rendering timed out")
            return
        except Exception as e:
            print(f"Exception during video creation: {str(e)}")
            update_video_status(video_id, "failed", 0, "", f"Video creation error: {str(e)}")
            return
        
        update_video_status(video_id, "processing", 95, "Finalizing video file...")
        
        # Wait a moment for file system to sync
        import time
        time.sleep(2)
        
        # Check if video was created successfully
        try:
            if not os.path.exists(output_path):
                print(f"Output file does not exist: {output_path}")
                update_video_status(video_id, "failed", 0, "", "Video file was not created")
                return
                
            file_size = os.path.getsize(output_path)
            print(f"Video file created successfully: {file_size} bytes")
            
            if file_size < 10000:  # If file is too small (less than 10KB), it probably failed
                print(f"Video file too small: {file_size} bytes")
                update_video_status(video_id, "failed", 0, "", f"Video file too small ({file_size} bytes) - creation failed")
                return
        except Exception as e:
            print(f"Error checking video file: {str(e)}")
            update_video_status(video_id, "failed", 0, "", "Could not verify video file")
            return
        
        print(f"Video creation successful, updating status to completed")
        
        # Mark as completed
        update_video_status(video_id, "completed", 100, "Video ready for download!")
        
        # Update final result
        video_status[video_id].update({
            "video_path": output_path,
            "duration": audio_duration,
            "file_size": file_size,
            "clips_used": 1  # Using thumbnail as single "clip"
        })
        
        print(f"Video creation completed successfully: {video_id}, size: {file_size} bytes, duration: {audio_duration}s")
        
    except Exception as e:
        print(f"Video processing failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        update_video_status(video_id, "failed", 0, "", f"Processing error: {str(e)}")

@app.post("/api/assemble-video")
async def assemble_video(request: dict):
    """Start background video assembly"""
    try:
        script_id = request.get("script_id")
        topic = request.get("topic", "")
        
        if not script_id:
            raise HTTPException(status_code=400, detail="script_id is required")
        
        # Generate unique video ID
        video_id = str(uuid.uuid4())
        
        # Initialize status
        update_video_status(video_id, "processing", 0, "Initializing video assembly...")
        
        # Start background processing
        thread = threading.Thread(
            target=process_video_background,
            args=(video_id, script_id, topic),
            daemon=True
        )
        thread.start()
        
        return {
            "video_id": video_id,
            "status": "processing",
            "message": "Video assembly started in background"
        }
        
    except Exception as e:
        print(f"Video assembly startup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start video assembly: {str(e)}")

@app.get("/api/video-status/{video_id}")
async def get_video_status(video_id: str):
    """Get video processing status"""
    try:
        # Try to get from memory first
        if video_id in video_status:
            status = video_status[video_id]
        else:
            # Try to load from file
            status_file = f"generated_content/status/{video_id}.json"
            if os.path.exists(status_file):
                with open(status_file, 'r') as f:
                    status = json.load(f)
                    video_status[video_id] = status  # Cache in memory
            else:
                raise HTTPException(status_code=404, detail="Video not found")
        
        # Check if video file exists but status shows processing/failed (recovery mechanism)
        if status.get("status") in ["processing", "failed"]:
            video_file = f"generated_content/videos/{video_id}.mp4"
            if os.path.exists(video_file):
                try:
                    file_size = os.path.getsize(video_file)
                    if file_size > 50000:  # File exists and is reasonable size (50KB+)
                        print(f"Recovering video status for {video_id} - file exists with size {file_size}")
                        
                        # Get audio duration for better metadata
                        try:
                            import subprocess
                            duration_cmd = ['/usr/bin/ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', 
                                          '-of', 'default=noprint_wrappers=1:nokey=1', video_file]
                            duration_result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=10)
                            video_duration = float(duration_result.stdout.strip()) if duration_result.stdout.strip() else None
                        except:
                            video_duration = None
                        
                        # Update status to completed
                        status.update({
                            "status": "completed",
                            "progress": 100,
                            "message": "Video ready for download!",
                            "file_size": file_size,
                            "video_path": video_file,
                            "duration": video_duration or status.get("duration", 60),
                            "clips_used": 1
                        })
                        video_status[video_id] = status
                        update_video_status(video_id, "completed", 100, "Video ready for download!")
                        
                        # Also update the persistent file data
                        try:
                            video_status[video_id].update({
                                "file_size": file_size,
                                "duration": video_duration or status.get("duration", 60)
                            })
                        except:
                            pass
                            
                except Exception as e:
                    print(f"Error in status recovery: {e}")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@app.get("/api/download/{file_type}/{file_id}")
async def download_file(file_type: str, file_id: str):
    """Download generated files"""
    try:
        file_paths = {
            "script": f"generated_content/scripts/{file_id}.txt",
            "audio": f"generated_content/audio/{file_id}.mp3", 
            "thumbnail": f"generated_content/thumbnails/{file_id}.png",
            "video": f"generated_content/videos/{file_id}.mp4"
        }
        
        if file_type not in file_paths:
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        file_path = file_paths[file_type]
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # For video files, set appropriate media type
        if file_type == "video":
            media_type = "video/mp4"
            filename = f"{file_id}.mp4"
        elif file_type == "audio":
            media_type = "audio/mpeg"
            filename = f"{file_id}.mp3"
        elif file_type == "thumbnail":
            media_type = "image/png"
            filename = f"{file_id}.png"
        else:
            media_type = "text/plain"
            filename = f"{file_id}.txt"
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=media_type
        )
        
    except HTTPException:
        # Re-raise HTTPExceptions to preserve status codes
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File download failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)