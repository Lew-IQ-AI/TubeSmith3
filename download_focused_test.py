#!/usr/bin/env python3
"""
TubeSmith Download Functionality - Focused Testing
Tests all download endpoints as requested in the review
"""

import requests
import sys
from datetime import datetime

class DownloadTester:
    def __init__(self, base_url="https://42998885-3c1d-469d-bc1a-ade47f549193.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

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
        return success

    def test_download_endpoints(self):
        """Test all download endpoints as specified in review request"""
        print("🔍 Testing Download Endpoints (/api/download/{file_type}/{file_id})")
        print("=" * 70)
        
        # Use existing files from previous tests
        test_cases = [
            {
                "file_type": "script",
                "file_id": "0c90d496-a7eb-4408-bff1-7fb9cc169096",
                "expected_content_type": "text/plain",
                "expected_extension": ".txt",
                "description": "Script download - should return .txt file"
            },
            {
                "file_type": "audio", 
                "file_id": "a73409c0-4192-41e9-9329-3c2a7dfb8932",
                "expected_content_type": "audio/mpeg",
                "expected_extension": ".mp3",
                "description": "Audio download - should return .mp3 file"
            },
            {
                "file_type": "thumbnail",
                "file_id": "78753f66-df79-49d2-af80-d05c72fedf05", 
                "expected_content_type": "image/png",
                "expected_extension": ".png",
                "description": "Thumbnail download - should return .png file"
            },
            {
                "file_type": "video",
                "file_id": "237bd775-0fe5-4a66-b8f4-e89c3dc56c11",
                "expected_content_type": "video/mp4", 
                "expected_extension": ".mp4",
                "description": "Video download - should return .mp4 file"
            }
        ]
        
        all_passed = True
        
        for test_case in test_cases:
            print(f"\n📋 Testing: {test_case['description']}")
            
            try:
                response = requests.get(
                    f"{self.base_url}/api/download/{test_case['file_type']}/{test_case['file_id']}",
                    timeout=30
                )
                
                if response.status_code == 200:
                    # Check content type
                    content_type = response.headers.get('content-type', '')
                    content_length = len(response.content)
                    
                    # Verify content type
                    ct_correct = test_case['expected_content_type'] in content_type
                    
                    # Verify reasonable file size
                    size_reasonable = content_length > 100
                    
                    # Check filename in content-disposition if present
                    content_disposition = response.headers.get('content-disposition', '')
                    filename_correct = test_case['expected_extension'] in content_disposition or content_disposition == ''
                    
                    if ct_correct and size_reasonable:
                        details = f"✅ {content_length:,} bytes, Content-Type: {content_type}"
                        success = self.log_test(f"{test_case['file_type'].title()} Download", True, details)
                    else:
                        details = f"❌ Size: {content_length}, CT: {content_type}, Expected: {test_case['expected_content_type']}"
                        success = self.log_test(f"{test_case['file_type'].title()} Download", False, details)
                    
                    all_passed = all_passed and success
                    
                else:
                    success = self.log_test(f"{test_case['file_type'].title()} Download", False, f"HTTP {response.status_code}")
                    all_passed = False
                    
            except Exception as e:
                success = self.log_test(f"{test_case['file_type'].title()} Download", False, f"Error: {str(e)}")
                all_passed = False
        
        return all_passed

    def test_file_type_validation(self):
        """Test file type validation"""
        print(f"\n🔍 Testing File Type Validation")
        print("=" * 50)
        
        # Test invalid file type
        try:
            response = requests.get(f"{self.base_url}/api/download/invalid/test-id", timeout=10)
            success = response.status_code == 400
            details = f"HTTP {response.status_code} (expected 400)"
            self.log_test("Invalid File Type Rejection", success, details)
            return success
        except Exception as e:
            self.log_test("Invalid File Type Rejection", False, f"Error: {str(e)}")
            return False

    def test_file_access_validation(self):
        """Test file access validation"""
        print(f"\n🔍 Testing File Access Validation")
        print("=" * 50)
        
        # Test non-existent file
        try:
            response = requests.get(f"{self.base_url}/api/download/script/non-existent-file-id", timeout=10)
            success = response.status_code == 404
            details = f"HTTP {response.status_code} (expected 404)"
            self.log_test("Non-existent File Handling", success, details)
            return success
        except Exception as e:
            self.log_test("Non-existent File Handling", False, f"Error: {str(e)}")
            return False

    def test_content_types(self):
        """Test content types are correct"""
        print(f"\n🔍 Testing Content Types")
        print("=" * 50)
        
        content_type_tests = [
            ("script", "0c90d496-a7eb-4408-bff1-7fb9cc169096", "text/plain"),
            ("audio", "a73409c0-4192-41e9-9329-3c2a7dfb8932", "audio/mpeg"),
            ("thumbnail", "78753f66-df79-49d2-af80-d05c72fedf05", "image/png"),
            ("video", "237bd775-0fe5-4a66-b8f4-e89c3dc56c11", "video/mp4")
        ]
        
        all_passed = True
        
        for file_type, file_id, expected_ct in content_type_tests:
            try:
                response = requests.get(f"{self.base_url}/api/download/{file_type}/{file_id}", timeout=30)
                
                if response.status_code == 200:
                    actual_ct = response.headers.get('content-type', '')
                    success = expected_ct in actual_ct
                    details = f"Expected: {expected_ct}, Got: {actual_ct}"
                    self.log_test(f"{file_type.title()} Content-Type", success, details)
                    all_passed = all_passed and success
                else:
                    self.log_test(f"{file_type.title()} Content-Type", False, f"HTTP {response.status_code}")
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"{file_type.title()} Content-Type", False, f"Error: {str(e)}")
                all_passed = False
        
        return all_passed

    def run_all_tests(self):
        """Run all download functionality tests"""
        print("🚀 TubeSmith Download Functionality Testing")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 80)
        
        # Run all test categories
        test1 = self.test_download_endpoints()
        test2 = self.test_file_type_validation() 
        test3 = self.test_file_access_validation()
        test4 = self.test_content_types()
        
        # Print summary
        print("\n" + "=" * 80)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All download functionality tests passed! Download system is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    """Main test execution"""
    tester = DownloadTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())