import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import { useDropzone } from 'react-dropzone';
import './App.css';

// 3D Pose Visualization Component
const PoseVisualization = ({ poseData, currentFrame, errors = [], metrics = {} }) => {
  const groupRef = useRef();
  
  // MediaPipe pose connections for drawing skeleton
  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
    [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [25, 27], [24, 26], [26, 28], // Legs
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8] // Face
  ];
  
  if (!poseData || !poseData[currentFrame]) return null;
  
  const landmarks = poseData[currentFrame].pose_landmarks || [];
  if (landmarks.length < 33) return null;
  
  // Convert normalized coordinates to 3D space
  const points = landmarks.map(landmark => [
    (landmark.x - 0.5) * 4,  // Scale and center X
    -(landmark.y - 0.5) * 4, // Scale and flip Y
    landmark.z * 2           // Scale Z
  ]);
  
  return (
    <group ref={groupRef}>
      {/* Draw skeleton connections */}
      {connections.map((connection, index) => {
        const [start, end] = connection;
        if (start < points.length && end < points.length) {
          const startPoint = points[start];
          const endPoint = points[end];
          
          return (
            <Line
              key={index}
              points={[startPoint, endPoint]}
              color={errors.length > 2 ? "#ff4444" : errors.length > 0 ? "#ffaa00" : "#00ff88"}
              lineWidth={3}
            />
          );
        }
        return null;
      })}
      
      {/* Draw joint points */}
      {points.map((point, index) => (
        <Sphere key={index} position={point} args={[0.05, 8, 8]}>
          <meshStandardMaterial 
            color={
              [11, 12, 13, 14, 15, 16].includes(index) ? "#ff6b6b" : // Arms
              [23, 24, 25, 26, 27, 28].includes(index) ? "#4ecdc4" : // Legs
              "#ffd93d" // Other joints
            } 
          />
        </Sphere>
      ))}
      
      {/* Error indicators */}
      {errors.length > 0 && (
        <Text
          position={[0, 3, 0]}
          fontSize={0.3}
          color="#ff4444"
          anchorX="center"
          anchorY="middle"
        >
          {errors.length} Issues Detected
        </Text>
      )}
      
      {/* Score display */}
      {metrics.stance_score !== undefined && (
        <Text
          position={[0, -3, 0]}
          fontSize={0.4}
          color={metrics.stance_score > 70 ? "#00ff88" : "#ffaa00"}
          anchorX="center"
          anchorY="middle"
        >
          Score: {metrics.stance_score}/100
        </Text>
      )}
    </group>
  );
};

// Loading Animation Component
const LoadingSpinner = () => {
  const meshRef = useRef();
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffd93d" />
    </mesh>
  );
};

function App() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sampleVideos, setSampleVideos] = useState([]);
  const [showSamples, setShowSamples] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // File upload handling
  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file');
      return;
    }

    await analyzeVideo(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv']
    },
    maxFiles: 1
  });

  const analyzeVideo = async (file) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${BACKEND_URL}/api/analyze-video`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setAnalysis(result.analysis);
      setCurrentFrame(0);
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleVideos = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sample-videos`);
      if (!response.ok) throw new Error('Failed to load sample videos');
      
      const data = await response.json();
      setSampleVideos(data.videos || []);
      setShowSamples(true);
    } catch (err) {
      setError(`Failed to load sample videos: ${err.message}`);
    }
  };

  const analyzeSampleVideo = async (videoName) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setShowSamples(false);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-sample/${videoName}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setAnalysis(result.analysis);
      setCurrentFrame(0);
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
      console.error('Sample analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Animation controls
  const playAnimation = () => {
    if (!analysis?.pose_data) return;
    
    setIsPlaying(true);
    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= analysis.pose_data.length - 1) {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 100); // 10 FPS playback
  };

  const pauseAnimation = () => {
    setIsPlaying(false);
  };

  const resetAnimation = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };

  // Get current analysis data
  const getCurrentAnalysis = () => {
    if (!analysis?.analysis) return { errors: [], metrics: {} };
    
    const { stance_analysis, draw_analysis, anchor_analysis, release_analysis } = analysis.analysis;
    
    const allErrors = [
      ...(stance_analysis?.errors || []),
      ...(draw_analysis?.errors || []),
      ...(anchor_analysis?.errors || []),
      ...(release_analysis?.errors || [])
    ];

    const allMetrics = {
      ...stance_analysis?.metrics,
      ...draw_analysis?.metrics,
      ...anchor_analysis?.metrics,
      ...release_analysis?.metrics,
      overall_score: analysis.analysis.overall_score
    };

    return { errors: allErrors, metrics: allMetrics };
  };

  const currentAnalysis = getCurrentAnalysis();

  return (
    <div className="App">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>🏹 AI Archery Form Analyzer</h1>
          <p>Advanced biomechanical analysis and 3D visualization for archery form correction</p>
        </div>
      </header>

      <div className="main-content">
        {/* Upload Section */}
        {!analysis && !loading && (
          <div className="upload-section">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <div className="upload-content">
                <div className="upload-icon">📹</div>
                {isDragActive ? (
                  <p>Drop your archery video here...</p>
                ) : (
                  <>
                    <h3>Upload Archery Video</h3>
                    <p>Drag & drop your archery video here, or click to select</p>
                    <div className="supported-formats">
                      Supports: MP4, AVI, MOV, MKV
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="sample-section">
              <button 
                className="sample-btn"
                onClick={loadSampleVideos}
              >
                Try Sample Videos
              </button>
            </div>
          </div>
        )}

        {/* Sample Videos Modal */}
        {showSamples && (
          <div className="modal-overlay" onClick={() => setShowSamples(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>Sample Archery Videos</h3>
              <div className="sample-videos">
                {sampleVideos.map((video, index) => (
                  <div 
                    key={index}
                    className="sample-video-item"
                    onClick={() => analyzeSampleVideo(video.name)}
                  >
                    <div className="video-icon">🎬</div>
                    <div className="video-info">
                      <h4>{video.name}</h4>
                      <p>{(video.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                className="close-modal"
                onClick={() => setShowSamples(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-section">
            <div className="loading-3d">
              <Canvas camera={{ position: [0, 0, 5] }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <LoadingSpinner />
                <OrbitControls enableZoom={false} />
              </Canvas>
            </div>
            <h3>Analyzing Archery Form...</h3>
            <p>Processing video with AI pose estimation</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-section">
            <div className="error-icon">⚠️</div>
            <h3>Analysis Error</h3>
            <p>{error}</p>
            <button onClick={() => setError(null)}>Try Again</button>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !loading && (
          <div className="analysis-section">
            {/* 3D Visualization */}
            <div className="visualization-container">
              <div className="viz-header">
                <h3>3D Pose Analysis</h3>
                <div className="frame-info">
                  Frame: {currentFrame + 1} / {analysis.pose_data?.length || 0}
                </div>
              </div>
              
              <div className="canvas-container">
                <Canvas camera={{ position: [0, 0, 8] }}>
                  <ambientLight intensity={0.6} />
                  <pointLight position={[10, 10, 10]} intensity={1} />
                  <pointLight position={[-10, -10, 10]} intensity={0.5} />
                  
                  <PoseVisualization 
                    poseData={analysis.pose_data}
                    currentFrame={currentFrame}
                    errors={currentAnalysis.errors}
                    metrics={currentAnalysis.metrics}
                  />
                  
                  <OrbitControls 
                    enablePan={true} 
                    enableZoom={true} 
                    enableRotate={true}
                    minDistance={3}
                    maxDistance={15}
                  />
                </Canvas>
              </div>

              {/* Animation Controls */}
              <div className="controls">
                <button 
                  onClick={isPlaying ? pauseAnimation : playAnimation}
                  className="control-btn primary"
                >
                  {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
                <button 
                  onClick={resetAnimation}
                  className="control-btn"
                >
                  ⏮️ Reset
                </button>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, (analysis.pose_data?.length || 1) - 1)}
                  value={currentFrame}
                  onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
                  className="frame-slider"
                />
              </div>
            </div>

            {/* Analysis Results */}
            <div className="results-container">
              <div className="results-header">
                <h3>Analysis Results</h3>
                <div className="overall-score">
                  <span className="score-label">Overall Score:</span>
                  <span className={`score-value ${analysis.analysis.overall_score > 70 ? 'good' : 'needs-work'}`}>
                    {analysis.analysis.overall_score}/100
                  </span>
                </div>
              </div>

              {/* Errors and Issues */}
              {currentAnalysis.errors.length > 0 && (
                <div className="errors-section">
                  <h4>🚨 Issues Detected</h4>
                  <ul className="errors-list">
                    {currentAnalysis.errors.map((error, index) => (
                      <li key={index} className="error-item">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {analysis.analysis.recommendations && (
                <div className="recommendations-section">
                  <h4>💡 Recommendations</h4>
                  <ul className="recommendations-list">
                    {analysis.analysis.recommendations.map((rec, index) => (
                      <li key={index} className="recommendation-item">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Metrics */}
              <div className="metrics-section">
                <h4>📊 Detailed Metrics</h4>
                <div className="metrics-grid">
                  {Object.entries(currentAnalysis.metrics).map(([key, value]) => (
                    <div key={key} className="metric-item">
                      <span className="metric-label">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                      </span>
                      <span className="metric-value">
                        {typeof value === 'number' ? value.toFixed(1) : value}
                        {key.includes('score') && '%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* New Analysis Button */}
            <div className="new-analysis">
              <button 
                onClick={() => {
                  setAnalysis(null);
                  setCurrentFrame(0);
                  setError(null);
                }}
                className="new-analysis-btn"
              >
                🔄 Analyze New Video
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>Powered by AI Computer Vision • MediaPipe • Three.js</p>
      </footer>
    </div>
  );
}

export default App;