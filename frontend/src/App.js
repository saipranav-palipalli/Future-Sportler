import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line, Html, Box, Cone } from '@react-three/drei';
import { useDropzone } from 'react-dropzone';
import * as THREE from 'three';
import './App.css';

// 3D Annotation Components for Error Visualization
const ErrorArrow = ({ position, rotation, color = "#ff4444", label }) => {
  return (
    <group position={position} rotation={rotation}>
      <Cone args={[0.05, 0.3, 8]} position={[0, 0.15, 0]}>
        <meshStandardMaterial color={color} />
      </Cone>
      <Box args={[0.02, 0.3, 0.02]} position={[0, -0.15, 0]}>
        <meshStandardMaterial color={color} />
      </Box>
      {label && (
        <Html position={[0, 0.4, 0]}>
          <div className="error-label">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
};

const AngleIndicator = ({ start, end, center, angle, color = "#ffd93d" }) => {
  const points = [];
  const radius = 0.3;
  const segments = 20;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const currentAngle = angle * t;
    points.push([
      center[0] + radius * Math.cos(currentAngle),
      center[1] + radius * Math.sin(currentAngle),
      center[2]
    ]);
  }
  
  return (
    <group>
      <Line points={points} color={color} lineWidth={3} />
      <Html position={center}>
        <div className="angle-indicator">
          {Math.abs(angle * 180 / Math.PI).toFixed(1)}°
        </div>
      </Html>
    </group>
  );
};

// Enhanced 3D Pose Visualization with Annotations
const PoseVisualization = ({ poseData, currentFrame, errors = [], metrics = {}, analysis = {} }) => {
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
  
  // Calculate error annotations based on analysis
  const getErrorAnnotations = () => {
    const annotations = [];
    
    // Stance error annotation
    if (errors.some(e => e.toLowerCase().includes('stance'))) {
      const leftAnkle = points[27];
      const rightAnkle = points[28];
      if (leftAnkle && rightAnkle) {
        annotations.push(
          <ErrorArrow
            key="stance-error"
            position={[(leftAnkle[0] + rightAnkle[0]) / 2, leftAnkle[1] - 0.5, leftAnkle[2]]}
            rotation={[0, 0, Math.PI]}
            color="#ff4444"
            label="Adjust Stance Width"
          />
        );
      }
    }
    
    // Shoulder alignment error
    if (errors.some(e => e.toLowerCase().includes('shoulder') || e.toLowerCase().includes('alignment'))) {
      const leftShoulder = points[11];
      const rightShoulder = points[12];
      if (leftShoulder && rightShoulder) {
        const angle = Math.atan2(rightShoulder[1] - leftShoulder[1], rightShoulder[0] - leftShoulder[0]);
        annotations.push(
          <AngleIndicator
            key="shoulder-angle"
            start={leftShoulder}
            end={rightShoulder}
            center={[(leftShoulder[0] + rightShoulder[0]) / 2, (leftShoulder[1] + rightShoulder[1]) / 2, leftShoulder[2]]}
            angle={angle}
            color="#ff6b6b"
          />
        );
        annotations.push(
          <ErrorArrow
            key="shoulder-error"
            position={[rightShoulder[0] + 0.3, rightShoulder[1], rightShoulder[2]]}
            rotation={[0, 0, -Math.PI/4]}
            color="#ff6b6b"
            label="Level Shoulders"
          />
        );
      }
    }
    
    // Draw phase error (elbow position)
    if (errors.some(e => e.toLowerCase().includes('draw') || e.toLowerCase().includes('elbow'))) {
      const elbow = points[14]; // Right elbow
      const shoulder = points[12]; // Right shoulder
      const wrist = points[16]; // Right wrist
      
      if (elbow && shoulder && wrist) {
        annotations.push(
          <ErrorArrow
            key="draw-error"
            position={[elbow[0] + 0.2, elbow[1], elbow[2]]}
            rotation={[0, Math.PI/2, 0]}
            color="#ffaa00"
            label="Smooth Draw Path"
          />
        );
        
        // Show ideal vs actual elbow path
        annotations.push(
          <Line
            key="ideal-draw-path"
            points={[shoulder, [shoulder[0] + 1, shoulder[1], shoulder[2]]]}
            color="#00ff88"
            lineWidth={2}
            lineDashed={true}
          />
        );
      }
    }
    
    // Anchor point error
    if (errors.some(e => e.toLowerCase().includes('anchor'))) {
      const wrist = points[16];
      const nose = points[0];
      
      if (wrist && nose) {
        annotations.push(
          <ErrorArrow
            key="anchor-error"
            position={[wrist[0], wrist[1] + 0.3, wrist[2]]}
            rotation={[Math.PI, 0, 0]}
            color="#4ecdc4"
            label="Consistent Anchor"
          />
        );
        
        // Show target anchor zone
        annotations.push(
          <Sphere key="anchor-zone" position={nose} args={[0.15]} transparent>
            <meshStandardMaterial color="#4ecdc4" opacity={0.3} />
          </Sphere>
        );
      }
    }
    
    return annotations;
  };
  
  return (
    <group ref={groupRef}>
      {/* Draw skeleton connections */}
      {connections.map((connection, index) => {
        const [start, end] = connection;
        if (start < points.length && end < points.length) {
          const startPoint = points[start];
          const endPoint = points[end];
          
          // Color code based on body part and errors
          let lineColor = "#00ff88";
          if ([11, 12, 13, 14, 15, 16].includes(start) || [11, 12, 13, 14, 15, 16].includes(end)) {
            lineColor = errors.some(e => e.toLowerCase().includes('draw') || e.toLowerCase().includes('shoulder')) ? "#ff6b6b" : "#4ecdc4";
          } else if ([23, 24, 25, 26, 27, 28].includes(start) || [23, 24, 25, 26, 27, 28].includes(end)) {
            lineColor = errors.some(e => e.toLowerCase().includes('stance')) ? "#ff4444" : "#ffd93d";
          }
          
          return (
            <Line
              key={index}
              points={[startPoint, endPoint]}
              color={lineColor}
              lineWidth={4}
            />
          );
        }
        return null;
      })}
      
      {/* Draw joint points */}
      {points.map((point, index) => {
        // Size based on importance
        let size = 0.06;
        let color = "#ffffff";
        
        if ([11, 12, 13, 14, 15, 16].includes(index)) { // Arms
          size = 0.08;
          color = errors.some(e => e.toLowerCase().includes('draw') || e.toLowerCase().includes('shoulder')) ? "#ff6b6b" : "#4ecdc4";
        } else if ([23, 24, 27, 28].includes(index)) { // Stance points
          size = 0.08;
          color = errors.some(e => e.toLowerCase().includes('stance')) ? "#ff4444" : "#ffd93d";
        } else if ([0].includes(index)) { // Face/anchor reference
          size = 0.07;
          color = errors.some(e => e.toLowerCase().includes('anchor')) ? "#4ecdc4" : "#ffffff";
        }
        
        return (
          <Sphere key={index} position={point} args={[size, 12, 12]}>
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
          </Sphere>
        );
      })}
      
      {/* Error annotations and guidance */}
      {getErrorAnnotations()}
      
      {/* Performance score display */}
      <Html position={[0, 2.5, 0]}>
        <div className="score-display">
          <div className="score-main">
            {analysis.overall_score || 0}<span>/100</span>
          </div>
          <div className="score-label">Performance Score</div>
        </div>
      </Html>
      
      {/* Frame info */}
      <Html position={[-2, -2.5, 0]}>
        <div className="frame-display">
          Frame: {currentFrame + 1} / {poseData?.length || 0}
        </div>
      </Html>
    </group>
  );
};

// Loading Animation Component
const LoadingSpinner = () => {
  const meshRef = useRef();
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.3;
      meshRef.current.rotation.z += delta * 0.2;
    }
  });
  
  return (
    <group>
      <Box ref={meshRef} args={[0.5, 0.5, 0.5]}>
        <meshStandardMaterial color="#4ecdc4" metalness={0.8} roughness={0.2} />
      </Box>
      <Sphere position={[1, 0, 0]} args={[0.3, 16, 16]}>
        <meshStandardMaterial color="#ff6b6b" />
      </Sphere>
      <Sphere position={[-1, 0, 0]} args={[0.3, 16, 16]}>
        <meshStandardMaterial color="#ffd93d" />
      </Sphere>
    </group>
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
  const [selectedVideo, setSelectedVideo] = useState('');

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

  const analyzeVideo = async (file, videoName = '') => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedVideo(videoName);

    try {
      let response;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        response = await fetch(`${BACKEND_URL}/api/analyze-video`, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/analyze-sample/${videoName}`, {
          method: 'POST'
        });
      }

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
      // Sort videos in proper order (Video-1, Video-2, etc.)
      const sortedVideos = (data.videos || []).sort((a, b) => {
        const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
      setSampleVideos(sortedVideos);
      setShowSamples(true);
    } catch (err) {
      setError(`Failed to load sample videos: ${err.message}`);
    }
  };

  const analyzeSampleVideo = async (videoName) => {
    setShowSamples(false);
    await analyzeVideo(null, videoName);
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
    }, 120); // Slightly slower for better observation
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

  // Get video level information
  const getVideoLevel = (score) => {
    if (score >= 80) return { level: 'Expert', color: '#00ff88', icon: '🏆' };
    if (score >= 60) return { level: 'Advanced', color: '#4ecdc4', icon: '⭐' };
    if (score >= 40) return { level: 'Intermediate', color: '#ffd93d', icon: '📈' };
    if (score >= 20) return { level: 'Beginner', color: '#ffaa00', icon: '🎯' };
    return { level: 'Needs Practice', color: '#ff6b6b', icon: '💪' };
  };

  const videoLevel = getVideoLevel(analysis?.analysis?.overall_score || 0);

  return (
    <div className="App">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <div className="hero-text">
            <span className="hero-badge">
              <span className="badge-icon">🏹</span>
              AI-Powered Sports Analytics
            </span>
            <h1 className="hero-title">
              Master Your Archery Form with
              <span className="gradient-text"> Precision Analysis</span>
            </h1>
            <p className="hero-description">
              Professional-grade biomechanical analysis using advanced computer vision. 
              Get instant feedback on your stance, draw, anchor, and release technique with 
              quantified metrics and 3D visualizations.
            </p>
            
            {!analysis && !loading && (
              <div className="hero-actions">
                <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''}`}>
                  <input {...getInputProps()} />
                  <div className="upload-content">
                    <div className="upload-icon">📹</div>
                    <div className="upload-text">
                      <h3>Upload Your Video</h3>
                      <p>Drag & drop or click to select</p>
                    </div>
                  </div>
                </div>
                
                <div className="divider">
                  <span>or</span>
                </div>
                
                <button className="sample-btn" onClick={loadSampleVideos}>
                  <span className="btn-icon">🎬</span>
                  Try Sample Videos
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            )}
          </div>
          
          <div className="hero-visual">
            <div className="feature-cards">
              <div className="feature-card">
                <div className="card-icon">📊</div>
                <h3>Quantified Analysis</h3>
                <p>Precise angle measurements and biomechanical metrics</p>
              </div>
              <div className="feature-card">
                <div className="card-icon">🎯</div>
                <h3>Error Detection</h3>
                <p>Identify stance, draw, and release issues automatically</p>
              </div>
              <div className="feature-card">
                <div className="card-icon">💡</div>
                <h3>Actionable Feedback</h3>
                <p>Specific recommendations for immediate improvement</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Videos Modal */}
      {showSamples && (
        <div className="modal-overlay" onClick={() => setShowSamples(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Professional Archery Samples</h2>
              <p>Choose from curated videos showcasing different skill levels and techniques</p>
            </div>
            <div className="sample-videos-grid">
              {sampleVideos.map((video, index) => {
                const difficulty = index < 2 ? 'Beginner' : index < 4 ? 'Intermediate' : 'Advanced';
                const difficultyColor = difficulty === 'Beginner' ? '#ff6b6b' : 
                                       difficulty === 'Intermediate' ? '#ffd93d' : '#4ecdc4';
                return (
                  <div 
                    key={index}
                    className="sample-video-card"
                    onClick={() => analyzeSampleVideo(video.name)}
                  >
                    <div className="video-thumbnail">
                      <div className="play-icon">▶</div>
                    </div>
                    <div className="video-info">
                      <h4>{video.name}</h4>
                      <div className="video-meta">
                        <span className="video-size">{(video.size / 1024 / 1024).toFixed(1)} MB</span>
                        <span className="video-difficulty" style={{color: difficultyColor}}>
                          {difficulty}
                        </span>
                      </div>
                    </div>
                    <div className="video-overlay">
                      <span>Analyze Form</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="modal-close" onClick={() => setShowSamples(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Loading Section */}
      {loading && (
        <section className="analysis-loading">
          <div className="loading-container">
            <div className="loading-3d">
              <Canvas camera={{ position: [3, 3, 5], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, 10]} intensity={0.5} />
                <LoadingSpinner />
                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={2} />
              </Canvas>
            </div>
            <div className="loading-content">
              <h2>Analyzing Archery Form</h2>
              <div className="loading-steps">
                <div className="step active">
                  <span className="step-icon">🎥</span>
                  <span>Processing Video</span>
                </div>
                <div className="step active">
                  <span className="step-icon">🔍</span>
                  <span>Pose Estimation</span>
                </div>
                <div className="step">
                  <span className="step-icon">📊</span>
                  <span>Biomechanical Analysis</span>
                </div>
                <div className="step">
                  <span className="step-icon">🎯</span>
                  <span>Generating Feedback</span>
                </div>
              </div>
              {selectedVideo && (
                <p className="analyzing-video">Analyzing: {selectedVideo}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Error Section */}
      {error && (
        <section className="error-section">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>Analysis Error</h2>
            <p>{error}</p>
            <button className="retry-btn" onClick={() => setError(null)}>
              Try Again
            </button>
          </div>
        </section>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <section className="analysis-results">
          <div className="results-container">
            {/* Results Header */}
            <div className="results-header">
              <div className="video-info">
                <h2>Analysis Complete</h2>
                {selectedVideo && <p className="video-name">Video: {selectedVideo}</p>}
              </div>
              
              <div className="performance-summary">
                <div className="score-circle" style={{borderColor: videoLevel.color}}>
                  <span className="score-number">{analysis.analysis.overall_score}</span>
                  <span className="score-max">/100</span>
                </div>
                <div className="level-info">
                  <div className="level-badge" style={{backgroundColor: videoLevel.color}}>
                    {videoLevel.icon} {videoLevel.level}
                  </div>
                </div>
              </div>
            </div>

            <div className="analysis-layout">
              {/* 3D Visualization */}
              <div className="visualization-panel">
                <div className="panel-header">
                  <h3>3D Biomechanical Analysis</h3>
                  <div className="view-controls">
                    <span className="frame-counter">
                      Frame {currentFrame + 1} of {analysis.pose_data?.length || 0}
                    </span>
                  </div>
                </div>
                
                <div className="canvas-wrapper">
                  <Canvas camera={{ position: [4, 2, 6], fov: 50 }}>
                    <ambientLight intensity={0.4} />
                    <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                    <pointLight position={[-10, -10, 10]} intensity={0.5} />
                    
                    <PoseVisualization 
                      poseData={analysis.pose_data}
                      currentFrame={currentFrame}
                      errors={currentAnalysis.errors}
                      metrics={currentAnalysis.metrics}
                      analysis={analysis.analysis}
                    />
                    
                    <OrbitControls 
                      enablePan={true} 
                      enableZoom={true} 
                      enableRotate={true}
                      minDistance={3}
                      maxDistance={12}
                      target={[0, 0, 0]}
                    />
                    
                    {/* Grid for reference */}
                    <gridHelper args={[8, 8, '#333333', '#666666']} position={[0, -3, 0]} />
                  </Canvas>
                </div>

                {/* Enhanced Animation Controls */}
                <div className="controls-panel">
                  <div className="playback-controls">
                    <button 
                      onClick={resetAnimation}
                      className="control-btn"
                      title="Reset to start"
                    >
                      ⏮️
                    </button>
                    <button 
                      onClick={isPlaying ? pauseAnimation : playAnimation}
                      className="control-btn primary"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? '⏸️' : '▶️'}
                    </button>
                  </div>
                  
                  <div className="frame-control">
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, (analysis.pose_data?.length || 1) - 1)}
                      value={currentFrame}
                      onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
                      className="frame-slider"
                    />
                    <div className="frame-markers">
                      <span>Start</span>
                      <span>Draw</span>
                      <span>Anchor</span>
                      <span>Release</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Panel */}
              <div className="analysis-panel">
                {/* Issues & Corrections */}
                {currentAnalysis.errors.length > 0 && (
                  <div className="issues-section">
                    <h3>
                      <span className="section-icon">🚨</span>
                      Issues Detected ({currentAnalysis.errors.length})
                    </h3>
                    <div className="issues-list">
                      {currentAnalysis.errors.map((error, index) => {
                        const severity = error.toLowerCase().includes('poor') || error.toLowerCase().includes('excessive') ? 'high' : 
                                       error.toLowerCase().includes('inconsistent') ? 'medium' : 'low';
                        return (
                          <div key={index} className={`issue-item severity-${severity}`}>
                            <div className="issue-indicator"></div>
                            <div className="issue-content">
                              <p>{error}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actionable Recommendations */}
                {analysis.analysis.recommendations && (
                  <div className="recommendations-section">
                    <h3>
                      <span className="section-icon">💡</span>
                      Corrective Actions
                    </h3>
                    <div className="recommendations-list">
                      {analysis.analysis.recommendations.map((rec, index) => (
                        <div key={index} className="recommendation-item">
                          <div className="rec-number">{index + 1}</div>
                          <div className="rec-content">
                            <p>{rec}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Metrics */}
                <div className="metrics-section">
                  <h3>
                    <span className="section-icon">📊</span>
                    Performance Metrics
                  </h3>
                  <div className="metrics-grid">
                    {Object.entries(currentAnalysis.metrics).map(([key, value]) => {
                      if (key === 'overall_score') return null;
                      const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                      const percentage = key.includes('score') || key.includes('consistency');
                      
                      return (
                        <div key={key} className="metric-card">
                          <div className="metric-label">{displayName}</div>
                          <div className="metric-value">
                            {numValue.toFixed(1)}{percentage ? '%' : ''}
                          </div>
                          <div className="metric-bar">
                            <div 
                              className="metric-fill" 
                              style={{
                                width: percentage ? `${Math.min(numValue, 100)}%` : '100%',
                                backgroundColor: numValue > 70 ? '#4ecdc4' : numValue > 40 ? '#ffd93d' : '#ff6b6b'
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* New Analysis Button */}
            <div className="new-analysis-section">
              <button 
                onClick={() => {
                  setAnalysis(null);
                  setCurrentFrame(0);
                  setError(null);
                  setSelectedVideo('');
                }}
                className="new-analysis-btn"
              >
                <span className="btn-icon">🔄</span>
                Analyze Another Video
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;