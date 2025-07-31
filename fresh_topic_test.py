#!/usr/bin/env python3
"""
TubeSmith AI - Fresh Topic Video Generation Test
Testing with "artificial intelligence" and "ocean conservation" as requested in review
"""

import requests
import sys
import json
import time
from datetime import datetime

class FreshTopicTester:
    def __init__(self, base_url="https://42998885-3c1d-469d-bc1a-ade47f549193.preview.emergentagent.com"):
        self.base_url = base_url
        self.results = []

    def log_result(self, test_name, success, details, duration=None):
        """Log test results with timing"""
        status = "✅ PASS" if success else "❌ FAIL"
        duration_str = f" ({duration:.2f}s)" if duration else ""
        result = f"{status} - {test_name}{duration_str}"
        if details:
            result += f" | {details}"
        print(result)
        
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        })
        return success

    def test_end_to_end_workflow(self, topic):
        """Test complete end-to-end workflow with fresh topic"""
        print(f"\n🎯 Testing End-to-End Workflow: '{topic}'")
        print("=" * 60)
        
        # Step 1: Generate Script
        print(f"📝 Step 1: Generating script for '{topic}'...")
        start_time = time.time()
        try:
            payload = {
                "topic": topic,
                "duration_minutes": 2  # Short for faster testing
            }
            
            response = requests.post(f"{self.base_url}/api/generate-script",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=90)
            script_duration = time.time() - start_time
            
            if response.status_code != 200:
                self.log_result(f"Script Generation - {topic}", False, f"HTTP {response.status_code}", script_duration)
                return False
            
            script_data = response.json()
            script_id = script_data.get('script_id')
            word_count = script_data.get('word_count', 0)
            
            self.log_result(f"Script Generation - {topic}", True, f"ID: {script_id}, Words: {word_count}", script_duration)
            
        except Exception as e:
            script_duration = time.time() - start_time
            self.log_result(f"Script Generation - {topic}", False, f"Error: {str(e)}", script_duration)
            return False
        
        # Step 2: Generate Voice
        print(f"🎤 Step 2: Generating voice for '{topic}'...")
        start_time = time.time()
        try:
            response = requests.post(f"{self.base_url}/api/generate-voice",
                                   json={"script_id": script_id},
                                   headers={'Content-Type': 'application/json'},
                                   timeout=120)
            voice_duration = time.time() - start_time
            
            if response.status_code != 200:
                self.log_result(f"Voice Generation - {topic}", False, f"HTTP {response.status_code}", voice_duration)
                return False
            
            self.log_result(f"Voice Generation - {topic}", True, "Audio generated successfully", voice_duration)
            
        except Exception as e:
            voice_duration = time.time() - start_time
            self.log_result(f"Voice Generation - {topic}", False, f"Error: {str(e)}", voice_duration)
            return False
        
        # Step 3: Generate Thumbnail
        print(f"🖼️  Step 3: Generating thumbnail for '{topic}'...")
        start_time = time.time()
        try:
            response = requests.post(f"{self.base_url}/api/generate-thumbnail",
                                   json={"topic": topic},
                                   headers={'Content-Type': 'application/json'},
                                   timeout=60)
            thumbnail_duration = time.time() - start_time
            
            if response.status_code != 200:
                self.log_result(f"Thumbnail Generation - {topic}", False, f"HTTP {response.status_code}", thumbnail_duration)
                return False
            
            self.log_result(f"Thumbnail Generation - {topic}", True, "Thumbnail generated successfully", thumbnail_duration)
            
        except Exception as e:
            thumbnail_duration = time.time() - start_time
            self.log_result(f"Thumbnail Generation - {topic}", False, f"Error: {str(e)}", thumbnail_duration)
            return False
        
        # Step 4: Video Assembly
        print(f"🎥 Step 4: Assembling video for '{topic}'...")
        start_time = time.time()
        try:
            payload = {
                "script_id": script_id,
                "topic": topic
            }
            
            response = requests.post(f"{self.base_url}/api/assemble-video",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=30)
            assembly_duration = time.time() - start_time
            
            if response.status_code != 200:
                self.log_result(f"Video Assembly - {topic}", False, f"HTTP {response.status_code}", assembly_duration)
                return False
            
            assembly_data = response.json()
            video_id = assembly_data.get('video_id')
            
            self.log_result(f"Video Assembly - {topic}", True, f"Video ID: {video_id}", assembly_duration)
            
        except Exception as e:
            assembly_duration = time.time() - start_time
            self.log_result(f"Video Assembly - {topic}", False, f"Error: {str(e)}", assembly_duration)
            return False
        
        # Step 5: Wait for Video Processing
        print(f"⏳ Step 5: Waiting for video processing for '{topic}'...")
        max_wait = 300  # 5 minutes
        poll_start = time.time()
        
        try:
            while True:
                elapsed = time.time() - poll_start
                if elapsed > max_wait:
                    self.log_result(f"Video Processing - {topic}", False, f"Timeout after {elapsed:.1f}s", elapsed)
                    return False
                
                response = requests.get(f"{self.base_url}/api/video-status/{video_id}", timeout=10)
                
                if response.status_code != 200:
                    self.log_result(f"Video Processing - {topic}", False, f"HTTP {response.status_code}", elapsed)
                    return False
                
                status_data = response.json()
                status = status_data.get('status')
                progress = status_data.get('progress', 0)
                message = status_data.get('message', '')
                
                print(f"   📈 Status: {status}, Progress: {progress}%, Message: {message}")
                
                if status == 'completed':
                    file_size = status_data.get('file_size', 0)
                    duration = status_data.get('duration', 0)
                    clips_used = status_data.get('clips_used', 0)
                    
                    details = f"Size: {file_size} bytes, Duration: {duration}s, Clips: {clips_used}"
                    
                    if file_size > 10000:  # >10KB as mentioned in review
                        self.log_result(f"Video Processing - {topic}", True, details, elapsed)
                        break
                    else:
                        self.log_result(f"Video Processing - {topic}", False, f"File too small: {file_size} bytes", elapsed)
                        return False
                
                elif status == 'failed':
                    error = status_data.get('error', 'Unknown error')
                    self.log_result(f"Video Processing - {topic}", False, f"Processing failed: {error}", elapsed)
                    return False
                
                time.sleep(5)  # Poll every 5 seconds
                
        except Exception as e:
            elapsed = time.time() - poll_start
            self.log_result(f"Video Processing - {topic}", False, f"Error: {str(e)}", elapsed)
            return False
        
        # Step 6: Test Download
        print(f"📥 Step 6: Testing video download for '{topic}'...")
        start_time = time.time()
        try:
            response = requests.get(f"{self.base_url}/api/download/video/{video_id}", timeout=30)
            download_duration = time.time() - start_time
            
            if response.status_code == 200:
                content_length = len(response.content)
                content_type = response.headers.get('content-type', '')
                
                if 'video/mp4' in content_type and content_length > 10000:
                    details = f"Downloaded {content_length} bytes, Type: {content_type}"
                    self.log_result(f"Video Download - {topic}", True, details, download_duration)
                    return True
                else:
                    details = f"Invalid: {content_length} bytes, Type: {content_type}"
                    self.log_result(f"Video Download - {topic}", False, details, download_duration)
                    return False
            else:
                self.log_result(f"Video Download - {topic}", False, f"HTTP {response.status_code}", download_duration)
                return False
                
        except Exception as e:
            download_duration = time.time() - start_time
            self.log_result(f"Video Download - {topic}", False, f"Error: {str(e)}", download_duration)
            return False

    def run_fresh_topic_tests(self):
        """Run tests with fresh topics as requested in review"""
        print("🎯 TubeSmith Fresh Topic Testing - As Requested in Review")
        print("Testing: 'artificial intelligence' and 'ocean conservation'")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 80)
        
        topics = ["artificial intelligence", "ocean conservation"]
        successful_topics = 0
        
        for topic in topics:
            if self.test_end_to_end_workflow(topic):
                successful_topics += 1
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📊 Fresh Topic Test Results: {successful_topics}/{len(topics)} topics completed successfully")
        
        if successful_topics == len(topics):
            print("🎉 All fresh topic tests passed! Video generation working with new topics.")
            print("✅ Pexels integration creating dynamic videos with stock footage")
            print("✅ FFmpeg execution fix verified - video assembly fully functional")
            return True
        else:
            print("⚠️  Some fresh topic tests failed.")
            return False

def main():
    """Main execution"""
    tester = FreshTopicTester()
    success = tester.run_fresh_topic_tests()
    
    # Save results
    with open('/app/fresh_topic_test_results.json', 'w') as f:
        json.dump({
            "test_type": "fresh_topic_end_to_end",
            "timestamp": datetime.now().isoformat(),
            "focus": "artificial_intelligence_and_ocean_conservation",
            "results": tester.results,
            "overall_success": success
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())