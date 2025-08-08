#!/usr/bin/env python3
"""
Backend API Testing for AI Archery Form Analyzer
Tests all API endpoints and validates responses
"""

import requests
import sys
import json
from datetime import datetime
import time

class ArcheryAPITester:
    def __init__(self, base_url="https://180440f3-f4c5-44ad-a044-e7f30db291e8.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.timeout = 30

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    return self.log_test("Health Check", True, f"- Status: {data.get('status')}")
                else:
                    return self.log_test("Health Check", False, f"- Unexpected status: {data}")
            else:
                return self.log_test("Health Check", False, f"- HTTP {response.status_code}")
                
        except Exception as e:
            return self.log_test("Health Check", False, f"- Error: {str(e)}")

    def test_sample_videos_endpoint(self):
        """Test /api/sample-videos endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/sample-videos")
            
            if response.status_code == 200:
                data = response.json()
                videos = data.get("videos", [])
                
                if len(videos) == 5:  # Expected 5 sample videos
                    video_names = [v.get("name") for v in videos]
                    expected_videos = ["Video-1.mp4", "Video-2.mp4", "Video-3.mp4", "Video-4.mp4", "Video-5.mp4"]
                    
                    if all(name in video_names for name in expected_videos):
                        return self.log_test("Sample Videos List", True, f"- Found {len(videos)} videos: {video_names}")
                    else:
                        return self.log_test("Sample Videos List", False, f"- Missing expected videos. Found: {video_names}")
                else:
                    return self.log_test("Sample Videos List", False, f"- Expected 5 videos, got {len(videos)}")
            else:
                return self.log_test("Sample Videos List", False, f"- HTTP {response.status_code}")
                
        except Exception as e:
            return self.log_test("Sample Videos List", False, f"- Error: {str(e)}")

    def test_sample_video_analysis(self, video_name="Video-1.mp4"):
        """Test /api/analyze-sample/{video_name} endpoint"""
        try:
            print(f"\n🔍 Testing sample video analysis for {video_name}...")
            print("⏳ This may take 30-60 seconds for video processing...")
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/api/analyze-sample/{video_name}")
            processing_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["success", "file_id", "video_name", "analysis"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    return self.log_test(f"Sample Analysis ({video_name})", False, 
                                       f"- Missing fields: {missing_fields}")
                
                analysis = data.get("analysis", {})
                
                # Validate analysis structure
                analysis_fields = ["total_frames", "fps", "duration", "pose_data", "analysis"]
                missing_analysis = [field for field in analysis_fields if field not in analysis]
                
                if missing_analysis:
                    return self.log_test(f"Sample Analysis ({video_name})", False,
                                       f"- Missing analysis fields: {missing_analysis}")
                
                # Validate biomechanical analysis
                bio_analysis = analysis.get("analysis", {})
                bio_fields = ["stance_analysis", "draw_analysis", "anchor_analysis", "release_analysis", 
                             "errors", "overall_score", "recommendations"]
                missing_bio = [field for field in bio_fields if field not in bio_analysis]
                
                if missing_bio:
                    return self.log_test(f"Sample Analysis ({video_name})", False,
                                       f"- Missing biomechanical fields: {missing_bio}")
                
                # Validate pose data
                pose_data = analysis.get("pose_data", [])
                if not pose_data:
                    return self.log_test(f"Sample Analysis ({video_name})", False, "- No pose data found")
                
                # Check if pose data has proper structure
                first_frame = pose_data[0] if pose_data else {}
                pose_fields = ["frame", "timestamp", "pose_landmarks"]
                missing_pose = [field for field in pose_fields if field not in first_frame]
                
                if missing_pose:
                    return self.log_test(f"Sample Analysis ({video_name})", False,
                                       f"- Invalid pose data structure: missing {missing_pose}")
                
                # Validate landmarks count (MediaPipe has 33 pose landmarks)
                landmarks = first_frame.get("pose_landmarks", [])
                if len(landmarks) != 33:
                    return self.log_test(f"Sample Analysis ({video_name})", False,
                                       f"- Expected 33 landmarks, got {len(landmarks)}")
                
                # Summary of results
                overall_score = bio_analysis.get("overall_score", 0)
                errors_count = len(bio_analysis.get("errors", []))
                recommendations_count = len(bio_analysis.get("recommendations", []))
                
                details = (f"- Score: {overall_score}/100, "
                          f"Errors: {errors_count}, "
                          f"Recommendations: {recommendations_count}, "
                          f"Frames: {len(pose_data)}, "
                          f"Processing: {processing_time:.1f}s")
                
                return self.log_test(f"Sample Analysis ({video_name})", True, details)
                
            elif response.status_code == 404:
                return self.log_test(f"Sample Analysis ({video_name})", False, "- Video not found")
            else:
                return self.log_test(f"Sample Analysis ({video_name})", False, f"- HTTP {response.status_code}")
                
        except Exception as e:
            return self.log_test(f"Sample Analysis ({video_name})", False, f"- Error: {str(e)}")

    def test_invalid_video_analysis(self):
        """Test analysis with non-existent video"""
        try:
            response = self.session.post(f"{self.base_url}/api/analyze-sample/NonExistent.mp4")
            
            if response.status_code == 404:
                return self.log_test("Invalid Video Analysis", True, "- Correctly returned 404")
            else:
                return self.log_test("Invalid Video Analysis", False, 
                                   f"- Expected 404, got {response.status_code}")
                
        except Exception as e:
            return self.log_test("Invalid Video Analysis", False, f"- Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🏹 AI Archery Form Analyzer - Backend API Testing")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Test sequence
        tests = [
            self.test_health_endpoint,
            self.test_sample_videos_endpoint,
            lambda: self.test_sample_video_analysis("Video-1.mp4"),
            self.test_invalid_video_analysis,
        ]

        for test in tests:
            test()
            time.sleep(0.5)  # Brief pause between tests

        # Final results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend API is working correctly.")
            return 0
        else:
            failed = self.tests_run - self.tests_passed
            print(f"⚠️  {failed} test(s) failed. Backend needs attention.")
            return 1

def main():
    """Main test execution"""
    tester = ArcheryAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())