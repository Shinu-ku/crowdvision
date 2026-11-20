export type RiskLevel = 'NORMAL' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PerspectiveType = 'drone_top_down' | 'elevated_cctv' | 'ground_level' | 'standard';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  is_active: boolean;
}

export interface ZoneCapacity {
  id: string;
  zone_id: string;
  max_capacity: number;
  area_sqm: number;
  normal_threshold: number;
  low_threshold: number;
  moderate_threshold: number;
  high_threshold: number;
  critical_threshold: number;
}

export interface Zone {
  id: string;
  venue_id: string;
  name: string;
  zone_type: string;
  capacity?: ZoneCapacity;
}

export interface Venue {
  id: string;
  name: string;
  venue_type: string;
  total_capacity?: number;
  zones?: Zone[];
}

export interface EventItem {
  id: string;
  name: string;
  event_type: string;
  status: 'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'PAUSED';
  venue_id?: string;
  expected_attendance?: number;
  created_at: string;
}

export interface PolygonPoint {
  x: number;
  y: number;
}

export interface LayoutZoneData {
  id: string;
  name: string;
  zone_id?: string;
  zone_name?: string;
  zone_type: string;
  polygon_points: PolygonPoint[];
  capacity: number;
  max_capacity?: number;
  area_sqm?: number;
  color?: string;
}

export interface VenueLayout {
  id: string;
  venue_id: string;
  name: string;
  reference_image_path?: string;
  zones_data: LayoutZoneData[];
  calibration_homography?: number[][];
  camera_perspective?: PerspectiveType;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  event_id?: string;
  video_file_id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  sample_fps: number;
  frames_processed: number;
  total_sampled_frames: number;
  progress_pct: number;
  processing_fps?: number;
  avg_inference_ms?: number;
  max_people_detected: number;
  camera_perspective: PerspectiveType;
  error_message?: string;
  created_at: string;
}

export interface VideoFile {
  id: string;
  event_id: string;
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  created_at: string;
}

export interface DetectionBox {
  track_id: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  ground_contact: [number, number]; // [x, y]
  velocity?: [number, number]; // [vx, vy]
  zone_id?: string;
}

export interface DetectionSummary {
  id: string;
  job_id: string;
  frame_index: number;
  video_timestamp_sec: number;
  total_people: number;
  inference_ms: number;
  detections: DetectionBox[];
  heatmap_grid?: number[][];
}

export interface HeatmapData {
  job_id: string;
  video_timestamp_sec: number;
  current?: number[][];
  predicted?: {
    '30'?: number[][];
    '60'?: number[][];
    '180'?: number[][];
    '300'?: number[][];
    '30s'?: number[][];
    '60s'?: number[][];
    '180s'?: number[][];
    '300s'?: number[][];
    [key: string]: number[][] | undefined;
  };
}

export interface PredictionItem {
  id: string;
  job_id: string;
  zone_id: string;
  zone_name: string;
  video_timestamp_sec: number;
  horizon_seconds: number;
  current_occupancy: number;
  predicted_occupancy: number;
  predicted_change_pct: number;
  estimated_trend: 'rapidly_increasing' | 'increasing' | 'stable' | 'decreasing' | 'rapidly_decreasing';
  risk_category: RiskLevel;
  confidence: number;
  is_experimental: boolean;
}

export interface RiskItem {
  id: string;
  job_id: string;
  zone_id: string;
  zone_name: string;
  video_timestamp_sec: number;
  risk_level: RiskLevel;
  reason: string;
  monitoring_priority: number;
  requires_human_review: boolean;
  supporting_measurements?: Record<string, any>;
}

export interface AlertItem {
  id: string;
  event_id: string;
  zone_id?: string;
  zone_name?: string;
  category: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  video_timestamp_sec?: number;
  created_at: string;
  supporting_measurements?: Record<string, any>;
}

export interface ZoneTelemetry {
  zone_id: string;
  zone_name: string;
  people_count: number;
  occupancy_ratio: number;
  capacity_utilization_pct: number;
  density_value: number;
  inflow_rate: number;
  outflow_rate: number;
  net_flow: number;
  avg_speed?: number;
  movement_direction?: string;
  risk_level: RiskLevel;
  is_bottleneck: boolean;
  is_counterflow: boolean;
  video_timestamp_sec: number;
}

export interface EventZoneSummary {
  event_id: string;
  video_timestamp_sec: number;
  total_people: number;
  zones: ZoneTelemetry[];
  trend_series: {
    timestamp: number;
    total_people: number;
  }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  reasoning?: string[];
  recommendations?: string[];
  risk_evaluations?: Record<string, any>;
}

export interface ReportItem {
  id: string;
  event_id: string;
  title: string;
  report_type: string;
  executive_summary?: string;
  summary_data: {
    event_name?: string;
    venue_name?: string;
    max_concurrent_crowd?: number;
    frames_analyzed?: number;
    alert_metrics?: {
      total_alerts: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    zone_breakdown?: Record<string, {
      zone_name: string;
      peak_people: number;
      avg_people: number;
      peak_capacity_utilization_pct: number;
      max_inflow: number;
      max_outflow: number;
      bottleneck_count: number;
      counterflow_count: number;
    }>;
  };
  created_at: string;
}
