from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import json
import cv2
import mediapipe as mp
import numpy as np
from typing import List, Dict, Any
import uuid
from pathlib import Path
import math

# Initialize FastAPI app
app = FastAPI(title="Archery AI Analysis", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe
mp_pose = mp.solutions.pose
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Create directories
os.makedirs("/app/backend/uploads", exist_ok=True)
os.makedirs("/app/backend/results", exist_ok=True)

class ArcheryAnalyzer:
    def __init__(self):
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        self.holistic = mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=2,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
    
    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        """Analyze archery form from video"""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError("Could not open video file")
        
        frames_data = []
        frame_count = 0
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        while cap.read()[0]:
            ret, frame = cap.retrieve()
            if not ret:
                break
                
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe Pose
            pose_results = self.pose.process(rgb_frame)
            holistic_results = self.holistic.process(rgb_frame)
            
            if pose_results.pose_landmarks:
                # Extract pose landmarks
                landmarks = []
                for landmark in pose_results.pose_landmarks.landmark:
                    landmarks.append({
                        'x': landmark.x,
                        'y': landmark.y,
                        'z': landmark.z,
                        'visibility': landmark.visibility
                    })
                
                frames_data.append({
                    'frame': frame_count,
                    'timestamp': frame_count / fps,
                    'pose_landmarks': landmarks,
                    'pose_world_landmarks': [
                        {'x': lm.x, 'y': lm.y, 'z': lm.z} 
                        for lm in pose_results.pose_world_landmarks.landmark
                    ] if pose_results.pose_world_landmarks else []
                })
            
            frame_count += 1
            
            # Process every 5th frame for efficiency
            for _ in range(4):
                if cap.read()[0]:
                    frame_count += 1
                else:
                    break
        
        cap.release()
        
        # Analyze the extracted pose data
        analysis = self.perform_biomechanical_analysis(frames_data)
        
        return {
            'total_frames': total_frames,
            'fps': fps,
            'duration': total_frames / fps,
            'pose_data': frames_data,
            'analysis': analysis
        }
    
    def perform_biomechanical_analysis(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Perform biomechanical analysis on pose data"""
        if not frames_data:
            return {'errors': ['No valid pose data found']}
        
        errors = []
        metrics = {}
        phases = self.detect_shooting_phases(frames_data)
        
        # Analyze each component
        stance_analysis = self.analyze_stance(frames_data)
        draw_analysis = self.analyze_draw_phase(frames_data)
        anchor_analysis = self.analyze_anchor(frames_data)
        release_analysis = self.analyze_release(frames_data)
        
        errors.extend(stance_analysis.get('errors', []))
        errors.extend(draw_analysis.get('errors', []))
        errors.extend(anchor_analysis.get('errors', []))
        errors.extend(release_analysis.get('errors', []))
        
        return {
            'phases': phases,
            'stance_analysis': stance_analysis,
            'draw_analysis': draw_analysis,
            'anchor_analysis': anchor_analysis,
            'release_analysis': release_analysis,
            'errors': errors,
            'overall_score': self.calculate_overall_score(errors),
            'recommendations': self.generate_recommendations(errors)
        }
    
    def detect_shooting_phases(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Detect different phases of archery shot"""
        phases = {
            'setup': {'start': 0, 'end': len(frames_data) // 4},
            'draw': {'start': len(frames_data) // 4, 'end': len(frames_data) // 2},
            'anchor': {'start': len(frames_data) // 2, 'end': 3 * len(frames_data) // 4},
            'release': {'start': 3 * len(frames_data) // 4, 'end': len(frames_data)}
        }
        return phases
    
    def analyze_stance(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Analyze archer's stance and posture"""
        errors = []
        metrics = {}
        
        if not frames_data:
            return {'errors': ['No pose data available']}
        
        # Get first frame for stance analysis
        first_frame = frames_data[0]
        landmarks = first_frame.get('pose_landmarks', [])
        
        if len(landmarks) < 33:  # MediaPipe pose has 33 landmarks
            return {'errors': ['Incomplete pose detection']}
        
        # Analyze foot placement (landmarks 27, 28 = ankles)
        left_ankle = landmarks[27]
        right_ankle = landmarks[28]
        foot_distance = abs(left_ankle['x'] - right_ankle['x'])
        
        if foot_distance < 0.15:  # Too narrow
            errors.append("Stance too narrow - widen your feet for better balance")
        elif foot_distance > 0.35:  # Too wide  
            errors.append("Stance too wide - bring feet closer for stability")
        
        # Analyze body alignment (shoulders vs hips)
        left_shoulder = landmarks[11]
        right_shoulder = landmarks[12]
        left_hip = landmarks[23]
        right_hip = landmarks[24]
        
        shoulder_angle = math.atan2(
            right_shoulder['y'] - left_shoulder['y'],
            right_shoulder['x'] - left_shoulder['x']
        )
        hip_angle = math.atan2(
            right_hip['y'] - left_hip['y'], 
            right_hip['x'] - left_hip['x']
        )
        
        alignment_diff = abs(shoulder_angle - hip_angle) * 180 / math.pi
        if alignment_diff > 10:
            errors.append(f"Poor body alignment - shoulder/hip misalignment of {alignment_diff:.1f}°")
        
        metrics = {
            'foot_distance': foot_distance,
            'alignment_difference': alignment_diff,
            'stance_score': max(0, 100 - len(errors) * 25)
        }
        
        return {'errors': errors, 'metrics': metrics}
    
    def analyze_draw_phase(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Analyze draw phase mechanics"""
        errors = []
        metrics = {}
        
        if len(frames_data) < 2:
            return {'errors': ['Insufficient frames for draw analysis']}
        
        # Analyze elbow tracking during draw
        elbow_positions = []
        for frame in frames_data:
            landmarks = frame.get('pose_landmarks', [])
            if len(landmarks) >= 14:  # Right elbow is landmark 14
                elbow_positions.append({
                    'frame': frame['frame'],
                    'x': landmarks[14]['x'],
                    'y': landmarks[14]['y']
                })
        
        if len(elbow_positions) >= 2:
            # Check for smooth draw path
            position_changes = []
            for i in range(1, len(elbow_positions)):
                dx = elbow_positions[i]['x'] - elbow_positions[i-1]['x']
                dy = elbow_positions[i]['y'] - elbow_positions[i-1]['y']
                position_changes.append(math.sqrt(dx*dx + dy*dy))
            
            if position_changes:
                avg_movement = sum(position_changes) / len(position_changes)
                max_movement = max(position_changes)
                
                if max_movement > avg_movement * 3:
                    errors.append("Jerky draw motion detected - focus on smooth, controlled movement")
        
        # Analyze shoulder position during draw
        shoulder_consistency = self.analyze_shoulder_consistency(frames_data)
        if shoulder_consistency['error']:
            errors.append(shoulder_consistency['error'])
        
        metrics = {
            'draw_smoothness': 100 - min(100, len(position_changes) * 10) if position_changes else 0,
            'shoulder_consistency': shoulder_consistency['score']
        }
        
        return {'errors': errors, 'metrics': metrics}
    
    def analyze_anchor(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Analyze anchor point consistency"""
        errors = []
        metrics = {}
        
        # Analyze hand position relative to face
        anchor_frames = frames_data[len(frames_data)//2:]  # Focus on latter half
        hand_positions = []
        
        for frame in anchor_frames:
            landmarks = frame.get('pose_landmarks', [])
            if len(landmarks) >= 16:  # Right wrist is landmark 16
                wrist = landmarks[16]
                nose = landmarks[0]  # Nose landmark
                
                # Calculate distance from wrist to nose
                distance = math.sqrt(
                    (wrist['x'] - nose['x'])**2 + 
                    (wrist['y'] - nose['y'])**2
                )
                hand_positions.append(distance)
        
        if hand_positions:
            # Check consistency of anchor point
            avg_distance = sum(hand_positions) / len(hand_positions)
            max_variation = max(abs(d - avg_distance) for d in hand_positions)
            
            if max_variation > 0.05:  # 5% variation threshold
                errors.append(f"Inconsistent anchor point - variation of {max_variation*100:.1f}%")
            
            metrics['anchor_consistency'] = max(0, 100 - max_variation * 1000)
        
        return {'errors': errors, 'metrics': metrics}
    
    def analyze_release(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Analyze release technique"""
        errors = []
        metrics = {}
        
        # Analyze the last quarter of frames (release phase)
        release_frames = frames_data[3*len(frames_data)//4:]
        
        if len(release_frames) < 2:
            return {'errors': ['Insufficient frames for release analysis']}
        
        # Track hand movement during release
        hand_movements = []
        for i in range(1, len(release_frames)):
            curr_frame = release_frames[i]
            prev_frame = release_frames[i-1]
            
            curr_landmarks = curr_frame.get('pose_landmarks', [])
            prev_landmarks = prev_frame.get('pose_landmarks', [])
            
            if len(curr_landmarks) >= 16 and len(prev_landmarks) >= 16:
                curr_wrist = curr_landmarks[16]  # Right wrist
                prev_wrist = prev_landmarks[16]
                
                movement = math.sqrt(
                    (curr_wrist['x'] - prev_wrist['x'])**2 + 
                    (curr_wrist['y'] - prev_wrist['y'])**2
                )
                hand_movements.append(movement)
        
        if hand_movements:
            max_movement = max(hand_movements)
            if max_movement > 0.1:  # Threshold for excessive movement
                errors.append("Excessive hand movement during release - focus on clean back-tension release")
            
            metrics['release_smoothness'] = max(0, 100 - max_movement * 500)
        
        return {'errors': errors, 'metrics': metrics}
    
    def analyze_shoulder_consistency(self, frames_data: List[Dict]) -> Dict[str, Any]:
        """Analyze shoulder position consistency"""
        shoulder_positions = []
        
        for frame in frames_data:
            landmarks = frame.get('pose_landmarks', [])
            if len(landmarks) >= 12:
                left_shoulder = landmarks[11]
                right_shoulder = landmarks[12]
                
                # Calculate shoulder angle
                angle = math.atan2(
                    right_shoulder['y'] - left_shoulder['y'],
                    right_shoulder['x'] - left_shoulder['x']
                ) * 180 / math.pi
                
                shoulder_positions.append(angle)
        
        if len(shoulder_positions) >= 2:
            angle_variance = np.var(shoulder_positions)
            if angle_variance > 25:  # High variance threshold
                return {
                    'error': f"Inconsistent shoulder position - variance of {angle_variance:.1f}°",
                    'score': max(0, 100 - angle_variance * 2)
                }
            return {'error': None, 'score': 100 - angle_variance}
        
        return {'error': 'Insufficient data for shoulder analysis', 'score': 0}
    
    def calculate_overall_score(self, errors: List[str]) -> int:
        """Calculate overall performance score"""
        base_score = 100
        deductions = len(errors) * 15  # 15 points per error
        return max(0, base_score - deductions)
    
    def generate_recommendations(self, errors: List[str]) -> List[str]:
        """Generate specific recommendations based on detected errors"""
        recommendations = []
        
        for error in errors:
            if "stance" in error.lower():
                recommendations.append("Practice proper stance with feet shoulder-width apart")
            elif "draw" in error.lower() or "jerky" in error.lower():
                recommendations.append("Focus on slow, controlled draw with consistent back tension")
            elif "anchor" in error.lower():
                recommendations.append("Establish a consistent anchor point and practice holding it steady")
            elif "release" in error.lower():
                recommendations.append("Work on surprise release using back-tension technique")
            elif "shoulder" in error.lower():
                recommendations.append("Keep shoulders level and relaxed throughout the shot")
        
        if not recommendations:
            recommendations.append("Great form! Continue practicing to maintain consistency")
        
        return recommendations

# Initialize analyzer
analyzer = ArcheryAnalyzer()

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Archery AI Analysis API is running"}

@app.post("/api/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    """Analyze uploaded archery video"""
    try:
        # Validate file type
        if not file.content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="File must be a video")
        
        # Save uploaded file
        file_id = str(uuid.uuid4())
        file_path = f"/app/backend/uploads/{file_id}_{file.filename}"
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Analyze video
        result = analyzer.analyze_video(file_path)
        
        # Save results
        result_path = f"/app/backend/results/{file_id}.json"
        with open(result_path, "w") as f:
            json.dump(result, f, indent=2)
        
        # Clean up uploaded file
        os.remove(file_path)
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": file.filename,
            "analysis": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/api/sample-videos")
async def get_sample_videos():
    """Get list of sample archery videos"""
    sample_videos = []
    video_dir = Path("/app/videos/Archery")
    
    if video_dir.exists():
        for video_file in video_dir.glob("*.mp4"):
            sample_videos.append({
                "name": video_file.name,
                "path": str(video_file),
                "size": video_file.stat().st_size
            })
    
    return {"videos": sample_videos}

@app.post("/api/analyze-sample/{video_name}")
async def analyze_sample_video(video_name: str):
    """Analyze a sample video by name"""
    try:
        video_path = f"/app/videos/Archery/{video_name}"
        
        if not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Analyze video
        result = analyzer.analyze_video(video_path)
        
        # Generate unique ID for this analysis
        file_id = str(uuid.uuid4())
        
        # Save results
        result_path = f"/app/backend/results/{file_id}.json"
        with open(result_path, "w") as f:
            json.dump(result, f, indent=2)
        
        return {
            "success": True,
            "file_id": file_id,
            "video_name": video_name,
            "analysis": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)