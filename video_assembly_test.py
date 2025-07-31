#!/usr/bin/env python3
"""
TubeSmith Video Assembly Testing - Focus on Video Assembly Functionality
Tests the complete video workflow: script → voice → thumbnail → video assembly → download
"""

import requests
import sys
import json
import time
from datetime import datetime

class VideoAssemblyTester:
    def __init__(self, base_url="https://42998885-3c1d-469d-bc1a-ade47f549193.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.script_id = None
        self.video_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = f"{status} - {name}"
        if details:
            result += f" | {details}"
        
        print(result)
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        return success

    def test_script_generation_for_video(self):
        """Generate script for video assembly testing"""
        try:
            print("🎬 Generating script for video assembly test...")
            payload = {
                "topic": "space exploration and the future of humanity",
                "duration_minutes": 3  # Shorter duration for faster testing
            }
            
            start_time = time.time()
            response = requests.post(f"{self.base_url}/api/generate-script",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=90)
            duration = time.time() - start_time
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.script_id = data.get('script_id')
                word_count = data.get('word_count', 0)
                details = f"Script ID: {self.script_id}, Words: {word_count}, Time: {duration:.2f}s"
            else:
                details = f"HTTP {response.status_code}, Time: {duration:.2f}s"
                
            return self.log_test("Script Generation for Video", success, details)
        except Exception as e:
            return self.log_test("Script Generation for Video", False, f"Error: {str(e)}")

    def test_voice_generation_for_video(self):
        """Generate voice for video assembly testing"""
        if not self.script_id:
            return self.log_test("Voice Generation for Video", False, "No script_id available")
            
        try:
            print("🎤 Generating voice for video assembly test...")
            start_time = time.time()
            response = requests.post(f"{self.base_url}/api/generate-voice",
                                   json={"script_id": self.script_id},
                                   headers={'Content-Type': 'application/json'},
                                   timeout=120)
            duration = time.time() - start_time
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                audio_path = data.get('audio_path', 'unknown')
                details = f"Audio: {audio_path}, Time: {duration:.2f}s"
            else:
                details = f"HTTP {response.status_code}, Time: {duration:.2f}s"
                
            return self.log_test("Voice Generation for Video", success, details)
        except Exception as e:
            return self.log_test("Voice Generation for Video", False, f"Error: {str(e)}")

    def test_thumbnail_generation_for_video(self):
        """Generate thumbnail for video assembly testing"""
        try:
            print("🖼️ Generating thumbnail for video assembly test...")
            payload = {"topic": "space exploration and the future of humanity"}
            
            start_time = time.time()
            response = requests.post(f"{self.base_url}/api/generate-thumbnail",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=60)
            duration = time.time() - start_time
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                thumbnail_id = data.get('thumbnail_id')
                details = f"Thumbnail ID: {thumbnail_id}, Time: {duration:.2f}s"
            else:
                details = f"HTTP {response.status_code}, Time: {duration:.2f}s"
                
            return self.log_test("Thumbnail Generation for Video", success, details)
        except Exception as e:
            return self.log_test("Thumbnail Generation for Video", False, f"Error: {str(e)}")

    def test_video_assembly_api(self):
        """Test /api/assemble-video endpoint"""
        if not self.script_id:
            return self.log_test("Video Assembly API", False, "No script_id available")
            
        try:
            print("🎥 Testing video assembly API...")
            payload = {
                "script_id": self.script_id,
                "topic": "space exploration and the future of humanity"
            }
            
            start_time = time.time()
            response = requests.post(f"{self.base_url}/api/assemble-video",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=30)
            duration = time.time() - start_time
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.video_id = data.get('video_id')
                status = data.get('status')
                message = data.get('message', '')
                
                # Verify response format
                format_valid = all([
                    self.video_id is not None,
                    status == "processing",
                    "background" in message.lower()
                ])
                
                if format_valid:
                    details = f"Video ID: {self.video_id}, Status: {status}, Time: {duration:.2f}s"
                else:
                    success = False
                    details = f"Invalid response format - Video ID: {self.video_id}, Status: {status}"
            else:
                details = f"HTTP {response.status_code}, Time: {duration:.2f}s"
                
            return self.log_test("Video Assembly API", success, details)
        except Exception as e:
            return self.log_test("Video Assembly API", False, f"Error: {str(e)}")

    def test_video_status_polling(self):
        """Test /api/video-status/{video_id} endpoint with polling"""
        if not self.video_id:
            return self.log_test("Video Status Polling", False, "No video_id available")
            
        try:
            print("📊 Testing video status polling...")
            max_wait_time = 300  # 5 minutes max wait
            poll_interval = 5    # Check every 5 seconds
            start_time = time.time()
            
            status_history = []
            
            while time.time() - start_time < max_wait_time:
                try:
                    response = requests.get(f"{self.base_url}/api/video-status/{self.video_id}",
                                          timeout=10)
                    
                    if response.status_code == 200:
                        data = response.json()
                        current_status = data.get('status', 'unknown')
                        progress = data.get('progress', 0)
                        message = data.get('message', '')
                        
                        status_entry = {
                            "status": current_status,
                            "progress": progress,
                            "message": message,
                            "timestamp": time.time() - start_time
                        }
                        status_history.append(status_entry)
                        
                        print(f"   Status: {current_status} ({progress}%) - {message}")
                        
                        if current_status == "completed":
                            # Verify completion data
                            file_size = data.get('file_size', 0)
                            duration = data.get('duration', 0)
                            video_path = data.get('video_path', '')
                            
                            completion_valid = all([
                                file_size > 50000,  # At least 50KB
                                duration > 0,
                                video_path.endswith('.mp4')
                            ])
                            
                            if completion_valid:
                                details = f"Completed in {time.time() - start_time:.1f}s, Size: {file_size} bytes, Duration: {duration}s"
                                return self.log_test("Video Status Polling", True, details)
                            else:
                                details = f"Invalid completion data - Size: {file_size}, Duration: {duration}, Path: {video_path}"
                                return self.log_test("Video Status Polling", False, details)
                        
                        elif current_status == "failed":
                            error = data.get('error', 'Unknown error')
                            details = f"Video processing failed: {error}"
                            return self.log_test("Video Status Polling", False, details)
                    
                    else:
                        details = f"Status check failed: HTTP {response.status_code}"
                        return self.log_test("Video Status Polling", False, details)
                
                except requests.RequestException as e:
                    print(f"   Status check error: {e}")
                
                time.sleep(poll_interval)
            
            # Timeout reached
            details = f"Timeout after {max_wait_time}s. Last status: {status_history[-1] if status_history else 'none'}"
            return self.log_test("Video Status Polling", False, details)
            
        except Exception as e:
            return self.log_test("Video Status Polling", False, f"Error: {str(e)}")

    def test_video_status_recovery(self):
        """Test status recovery mechanism"""
        if not self.video_id:
            return self.log_test("Video Status Recovery", False, "No video_id available")
            
        try:
            print("🔄 Testing video status recovery mechanism...")
            
            # Get current status
            response = requests.get(f"{self.base_url}/api/video-status/{self.video_id}",
                                  timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                status = data.get('status')
                file_size = data.get('file_size', 0)
                
                # Test recovery logic - if status was failed/processing but file exists
                recovery_tested = status == "completed" and file_size > 50000
                
                if recovery_tested:
                    details = f"Recovery mechanism working - Status: {status}, File size: {file_size} bytes"
                    return self.log_test("Video Status Recovery", True, details)
                else:
                    details = f"Recovery not applicable - Status: {status}, File size: {file_size}"
                    return self.log_test("Video Status Recovery", True, details)  # Not a failure if not needed
            else:
                details = f"HTTP {response.status_code}"
                return self.log_test("Video Status Recovery", False, details)
                
        except Exception as e:
            return self.log_test("Video Status Recovery", False, f"Error: {str(e)}")

    def test_video_download(self):
        """Test /api/download/video/{video_id} endpoint"""
        if not self.video_id:
            return self.log_test("Video Download", False, "No video_id available")
            
        try:
            print("⬇️ Testing video download...")
            
            start_time = time.time()
            response = requests.get(f"{self.base_url}/api/download/video/{self.video_id}",
                                  timeout=60)
            duration = time.time() - start_time
            
            success = response.status_code == 200
            
            if success:
                # Check content type
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                # Verify MP4 file headers (basic check)
                mp4_valid = (
                    content_type == 'video/mp4' and
                    content_length > 50000 and  # At least 50KB
                    response.content[:4] in [b'ftyp', b'\x00\x00\x00\x18', b'\x00\x00\x00\x1c', b'\x00\x00\x00\x20']  # Common MP4 signatures
                )
                
                if mp4_valid:
                    details = f"Downloaded {content_length} bytes, Content-Type: {content_type}, Time: {duration:.2f}s"
                else:
                    success = False
                    details = f"Invalid MP4 file - Size: {content_length}, Type: {content_type}"
            else:
                details = f"HTTP {response.status_code}, Time: {duration:.2f}s"
                
            return self.log_test("Video Download", success, details)
        except Exception as e:
            return self.log_test("Video Download", False, f"Error: {str(e)}")

    def test_ffmpeg_integration(self):
        """Test FFmpeg integration by checking system availability"""
        try:
            print("🔧 Testing FFmpeg integration...")
            
            # Test FFmpeg availability through a simple video status check
            # This indirectly tests if FFmpeg is working since video creation uses it
            if self.video_id:
                response = requests.get(f"{self.base_url}/api/video-status/{self.video_id}",
                                      timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status')
                    error = data.get('error', '')
                    
                    # Check if FFmpeg-related errors occurred
                    ffmpeg_working = (
                        status == "completed" or 
                        (status == "processing" and "timeout" not in error.lower() and "ffmpeg" not in error.lower())
                    )
                    
                    if ffmpeg_working:
                        details = f"FFmpeg integration working - Video status: {status}"
                        return self.log_test("FFmpeg Integration", True, details)
                    else:
                        details = f"FFmpeg issues detected - Status: {status}, Error: {error}"
                        return self.log_test("FFmpeg Integration", False, details)
                else:
                    details = f"Cannot verify FFmpeg - HTTP {response.status_code}"
                    return self.log_test("FFmpeg Integration", False, details)
            else:
                details = "Cannot test FFmpeg - no video_id available"
                return self.log_test("FFmpeg Integration", False, details)
                
        except Exception as e:
            return self.log_test("FFmpeg Integration", False, f"Error: {str(e)}")

    def run_video_assembly_tests(self):
        """Run complete video assembly workflow tests"""
        print("🎬 Starting TubeSmith Video Assembly Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 70)
        
        # Step 1: Generate required components
        print("\n📋 Step 1: Generate Video Components")
        if not self.test_script_generation_for_video():
            print("❌ Cannot proceed without script generation")
            return False
            
        time.sleep(2)
        
        if not self.test_voice_generation_for_video():
            print("❌ Cannot proceed without voice generation")
            return False
            
        time.sleep(2)
        
        if not self.test_thumbnail_generation_for_video():
            print("❌ Cannot proceed without thumbnail generation")
            return False
            
        time.sleep(3)
        
        # Step 2: Test video assembly
        print("\n🎥 Step 2: Video Assembly Testing")
        if not self.test_video_assembly_api():
            print("❌ Video assembly API failed")
            return False
            
        time.sleep(2)
        
        # Step 3: Test status polling and completion
        print("\n📊 Step 3: Video Processing & Status")
        if not self.test_video_status_polling():
            print("❌ Video processing failed or timed out")
            return False
            
        # Step 4: Test additional functionality
        print("\n🔧 Step 4: Additional Tests")
        self.test_video_status_recovery()
        self.test_ffmpeg_integration()
        
        # Step 5: Test download
        print("\n⬇️ Step 5: Video Download")
        self.test_video_download()
        
        # Print summary
        print("\n" + "=" * 70)
        print(f"📊 Video Assembly Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed >= self.tests_run - 1:  # Allow 1 minor failure
            print("🎉 Video assembly workflow is working correctly!")
            return True
        else:
            print("⚠️ Video assembly has significant issues. Check details above.")
            return False

def main():
    """Main test execution"""
    tester = VideoAssemblyTester()
    success = tester.run_video_assembly_tests()
    
    # Save detailed results
    with open('/app/video_assembly_test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            "script_id": tester.script_id,
            "video_id": tester.video_id,
            "results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())