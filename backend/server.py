from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
import uuid
import asyncio
import json
from typing import Optional
from pydantic import BaseModel
import openai
import requests
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
import aiofiles
from dotenv import load_dotenv
from moviepy.editor import VideoFileClip, AudioFileClip, CompositeVideoClip, concatenate_videoclips, TextClip
import cv2
import tempfile
import shutil
import moviepy as mp
import ffmpeg
from pathlib import Path

# Load environment variables
load_dotenv()

app = FastAPI()

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
        - Add dramatic pauses and emphasis markers
        - Write in a conversational, engaging tone
        - Include call-to-action at the end
        
        Format the script with:
        [PAUSE] for dramatic pauses
        [EMPHASIS] around key phrases
        
        Topic: {request.topic}
        Duration: {request.duration_minutes} minutes
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
        Create a highly engaging, clickbait-style YouTube thumbnail for a video about "{topic}".
        
        Style requirements:
        - Bold, eye-catching design
        - Dramatic lighting and colors
        - High contrast and vibrant colors
        - Professional quality
        - Optimized for small screen viewing
        - Should evoke curiosity and emotion
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

@app.post("/api/assemble-video")
async def assemble_video(request: dict):
    """Assemble final video from components"""
    try:
        print(f"Starting video assembly for request: {request}")
        script_id = request.get("script_id")
        topic = request.get("topic", "")
        
        if not script_id:
            raise HTTPException(status_code=400, detail="script_id is required")
        
        # Check all required files exist
        script_path = f"generated_content/scripts/{script_id}.txt"
        audio_path = f"generated_content/audio/{script_id}.mp3"
        
        print(f"Checking files: {script_path}, {audio_path}")
        if not os.path.exists(script_path) or not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="Required files not found")
        
        # Simple response for now - just return that assembly started
        return {
            "video_id": str(uuid.uuid4()),
            "status": "processing",
            "message": "Video assembly started. This is a simplified version - actual video assembly will be implemented next."
        }
        
    except Exception as e:
        print(f"Video assembly error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Video assembly failed: {str(e)}")

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
        
        return FileResponse(
            path=file_path,
            filename=f"{file_id}.{file_type}",
            media_type='application/octet-stream'
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File download failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)