#!/usr/bin/env python3
"""
TubeSmith AI YouTube Generator - Backend API Testing
Tests all backend endpoints and AI integrations
"""

import requests
import sys
import json
from datetime import datetime
import time

class TubeSmithAPITester:
    def __init__(self, base_url="https://2a15b10f-fa95-4c92-8c6a-425efbcdc851.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {data.get('status', 'unknown')}, Message: {data.get('message', 'none')}"
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("Health Check", success, details)
        except Exception as e:
            return self.log_test("Health Check", False, f"Error: {str(e)}")

    def test_ai_integrations(self):
        """Test /api/test-integrations endpoint"""
        try:
            response = requests.post(f"{self.base_url}/api/test-integrations", 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=30)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                # Check each AI service
                openai_status = data.get('openai', {}).get('status', 'unknown')
                elevenlabs_status = data.get('elevenlabs', {}).get('status', 'unknown')
                pexels_status = data.get('pexels', {}).get('status', 'unknown')
                
                details = f"OpenAI: {openai_status}, ElevenLabs: {elevenlabs_status}, Pexels: {pexels_status}"
                
                # Log individual service results
                self.log_test("OpenAI Integration", openai_status == 'success', 
                            data.get('openai', {}).get('error', 'Working'))
                self.log_test("ElevenLabs Integration", elevenlabs_status == 'success',
                            data.get('elevenlabs', {}).get('error', 'Working'))
                self.log_test("Pexels Integration", pexels_status == 'success',
                            data.get('pexels', {}).get('error', 'Working'))
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("AI Integrations Test", success, details)
        except Exception as e:
            return self.log_test("AI Integrations Test", False, f"Error: {str(e)}")

    def test_generate_script(self):
        """Test /api/generate-script endpoint"""
        try:
            payload = {
                "topic": "artificial intelligence in healthcare",
                "duration_minutes": 5
            }
            response = requests.post(f"{self.base_url}/api/generate-script",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=60)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                script_id = data.get('script_id')
                word_count = data.get('word_count', 0)
                details = f"Script ID: {script_id}, Words: {word_count}"
                # Store script_id for voice generation test
                self.script_id = script_id
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("Script Generation", success, details)
        except Exception as e:
            return self.log_test("Script Generation", False, f"Error: {str(e)}")

    def test_generate_voice(self):
        """Test /api/generate-voice endpoint"""
        if not hasattr(self, 'script_id') or not self.script_id:
            return self.log_test("Voice Generation", False, "No script_id available")
            
        try:
            response = requests.post(f"{self.base_url}/api/generate-voice",
                                   json={"script_id": self.script_id},
                                   headers={'Content-Type': 'application/json'},
                                   timeout=120)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                audio_path = data.get('audio_path', 'unknown')
                details = f"Audio: {audio_path}"
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("Voice Generation", success, details)
        except Exception as e:
            return self.log_test("Voice Generation", False, f"Error: {str(e)}")

    def test_generate_thumbnail(self):
        """Test /api/generate-thumbnail endpoint"""
        try:
            payload = {"topic": "artificial intelligence in healthcare"}
            response = requests.post(f"{self.base_url}/api/generate-thumbnail",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=60)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                thumbnail_id = data.get('thumbnail_id')
                details = f"Thumbnail ID: {thumbnail_id}"
                self.thumbnail_id = thumbnail_id
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("Thumbnail Generation", success, details)
        except Exception as e:
            return self.log_test("Thumbnail Generation", False, f"Error: {str(e)}")

    def test_get_stock_videos(self):
        """Test /api/get-stock-videos endpoint"""
        try:
            payload = {"topic": "artificial intelligence", "count": 5}
            response = requests.post(f"{self.base_url}/api/get-stock-videos",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=30)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                total_found = data.get('total_found', 0)
                details = f"Videos found: {total_found}"
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("Stock Videos Search", success, details)
        except Exception as e:
            return self.log_test("Stock Videos Search", False, f"Error: {str(e)}")

    def test_generate_metadata(self):
        """Test /api/generate-youtube-metadata endpoint"""
        try:
            payload = {
                "topic": "artificial intelligence in healthcare",
                "script_content": "This is a sample script about AI in healthcare..."
            }
            response = requests.post(f"{self.base_url}/api/generate-youtube-metadata",
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=30)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                metadata_id = data.get('generated_at')
                details = f"Metadata generated: {metadata_id}"
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("YouTube Metadata Generation", success, details)
        except Exception as e:
            return self.log_test("YouTube Metadata Generation", False, f"Error: {str(e)}")

    def test_download_endpoints_comprehensive(self):
        """Comprehensive test of all download endpoints"""
        print("\n📥 Download Endpoints Testing:")
        
        # Test existing files from previous tests
        test_files = {
            "script": "237bd775-0fe5-4a66-b8f4-e89c3dc56c11",
            "audio": "a73409c0-4192-41e9-9329-3c2a7dfb8932", 
            "thumbnail": "78753f66-df79-49d2-af80-d05c72fedf05",
            "video": "237bd775-0fe5-4a66-b8f4-e89c3dc56c11"
        }
        
        expected_content_types = {
            "script": "text/plain",
            "audio": "audio/mpeg",
            "thumbnail": "image/png", 
            "video": "video/mp4"
        }
        
        expected_extensions = {
            "script": ".txt",
            "audio": ".mp3",
            "thumbnail": ".png",
            "video": ".mp4"
        }
        
        all_passed = True
        
        # Test each file type
        for file_type, file_id in test_files.items():
            try:
                response = requests.get(f"{self.base_url}/api/download/{file_type}/{file_id}",
                                      timeout=30)
                
                if response.status_code == 200:
                    # Check content type
                    content_type = response.headers.get('content-type', '')
                    expected_ct = expected_content_types[file_type]
                    
                    # Check content length
                    content_length = len(response.content)
                    
                    # Check filename in headers
                    content_disposition = response.headers.get('content-disposition', '')
                    expected_ext = expected_extensions[file_type]
                    
                    ct_correct = expected_ct in content_type
                    size_reasonable = content_length > 100  # At least 100 bytes
                    
                    if ct_correct and size_reasonable:
                        details = f"✅ {content_length} bytes, {content_type}"
                        success = self.log_test(f"Download {file_type.title()}", True, details)
                    else:
                        details = f"❌ Size: {content_length}, CT: {content_type}"
                        success = self.log_test(f"Download {file_type.title()}", False, details)
                    
                    all_passed = all_passed and success
                    
                else:
                    success = self.log_test(f"Download {file_type.title()}", False, f"HTTP {response.status_code}")
                    all_passed = False
                    
            except Exception as e:
                success = self.log_test(f"Download {file_type.title()}", False, f"Error: {str(e)}")
                all_passed = False
        
        # Test invalid file type
        try:
            response = requests.get(f"{self.base_url}/api/download/invalid/test-id", timeout=10)
            invalid_handled = response.status_code == 400
            self.log_test("Invalid File Type Handling", invalid_handled, 
                         f"HTTP {response.status_code} (expected 400)")
            all_passed = all_passed and invalid_handled
        except Exception as e:
            self.log_test("Invalid File Type Handling", False, f"Error: {str(e)}")
            all_passed = False
        
        # Test non-existent file
        try:
            response = requests.get(f"{self.base_url}/api/download/script/non-existent-id", timeout=10)
            not_found_handled = response.status_code == 404
            self.log_test("Non-existent File Handling", not_found_handled,
                         f"HTTP {response.status_code} (expected 404)")
            all_passed = all_passed and not_found_handled
        except Exception as e:
            self.log_test("Non-existent File Handling", False, f"Error: {str(e)}")
            all_passed = False
        
        return all_passed

    def test_download_endpoint(self):
        """Test /api/download endpoint - legacy method for compatibility"""
        if not hasattr(self, 'script_id') or not self.script_id:
            return self.log_test("File Download", False, "No script_id available")
            
        try:
            response = requests.get(f"{self.base_url}/api/download/script/{self.script_id}",
                                  timeout=30)
            success = response.status_code == 200
            
            if success:
                content_length = len(response.content)
                content_type = response.headers.get('content-type', '')
                details = f"Downloaded {content_length} bytes, {content_type}"
            else:
                details = f"HTTP {response.status_code}"
                
            return self.log_test("File Download", success, details)
        except Exception as e:
            return self.log_test("File Download", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting TubeSmith Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core functionality tests
        print("\n📋 Core API Tests:")
        self.test_health_endpoint()
        self.test_ai_integrations()
        
        # Content generation tests
        print("\n🎬 Content Generation Tests:")
        self.test_generate_script()
        time.sleep(2)  # Brief pause between tests
        
        self.test_generate_voice()
        time.sleep(2)
        
        self.test_generate_thumbnail()
        time.sleep(2)
        
        self.test_get_stock_videos()
        time.sleep(2)
        
        self.test_generate_metadata()
        time.sleep(2)
        
        # File operations tests
        print("\n📁 File Operations Tests:")
        self.test_download_endpoints_comprehensive()
        self.test_download_endpoint()  # Legacy test for newly generated files
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    """Main test execution"""
    tester = TubeSmithAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results to file
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            "results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())