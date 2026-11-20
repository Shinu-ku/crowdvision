import {
  EventItem,
  Venue,
  VenueLayout,
  VideoFile,
  ProcessingJob,
  DetectionSummary,
  HeatmapData,
  PredictionItem,
  RiskItem,
  AlertItem,
  EventZoneSummary,
  ReportItem,
  User,
} from '../types';

const API_BASE = '/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('crowdvision_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('crowdvision_token', token);
    } else {
      localStorage.removeItem('crowdvision_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Auto-relogin or clear token
      this.setToken(null);
    }

    if (!res.ok) {
      let errDetail = 'Request failed';
      try {
        const data = await res.json();
        if (typeof data.detail === 'string') {
          errDetail = data.detail;
        } else if (Array.isArray(data.detail)) {
          errDetail = data.detail
            .map((item: any) => {
              const field = item.loc ? item.loc[item.loc.length - 1] : '';
              return `${field ? field + ': ' : ''}${item.msg || JSON.stringify(item)}`;
            })
            .join(', ');
        } else if (data.detail && typeof data.detail === 'object') {
          errDetail = JSON.stringify(data.detail);
        } else {
          errDetail = JSON.stringify(data);
        }
      } catch {
        errDetail = res.statusText;
      }
      throw new Error(`[${res.status}] ${errDetail}`);
    }

    // For file downloads
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      return (await res.text()) as unknown as T;
    }

    return res.json();
  }

  // --- Auth ---
  async login(email = 'admin@crowdvision.io', password = 'admin123'): Promise<{ access_token: string }> {
    const res = await this.request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // --- Health ---
  async getHealth(): Promise<{ status: string; database: string; ai_agent_service: string }> {
    return this.request('/health/');
  }

  // --- Events / Tasks ---
  async getEvents(): Promise<EventItem[]> {
    return this.request<EventItem[]>('/events/');
  }

  async getEvent(id: string): Promise<EventItem> {
    return this.request<EventItem>(`/events/${id}`);
  }

  async createEvent(data: { name: string; event_type: string; venue_id?: string; expected_attendance?: number }): Promise<EventItem> {
    return this.request<EventItem>('/events/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Venues & Layouts ---
  async getVenues(): Promise<Venue[]> {
    return this.request<Venue[]>('/venues/');
  }

  async getVenue(id: string): Promise<Venue> {
    return this.request<Venue>(`/venues/${id}`);
  }

  async createVenue(data: { name: string; venue_type?: string; total_capacity?: number }): Promise<Venue> {
    return this.request<Venue>('/venues/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLayouts(venueId?: string): Promise<VenueLayout[]> {
    const query = venueId ? `?venue_id=${venueId}` : '';
    return this.request<VenueLayout[]>(`/layouts/${query}`);
  }

  async createLayout(data: {
    venue_id: string;
    name: string;
    zones_data: any[];
    calibration_homography?: number[][];
    camera_perspective?: string;
  }): Promise<VenueLayout> {
    return this.request<VenueLayout>('/layouts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Videos & Jobs ---
  async uploadVideo(
    eventId: string,
    file: File,
    sampleFps = 2.0,
    cameraPerspective = 'drone_top_down',
    autoProcess = false
  ): Promise<{ video_id: string; duration_seconds: number; fps: number; width: number; height: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('event_id', eventId);
    formData.append('sample_fps', sampleFps.toString());
    formData.append('camera_perspective', cameraPerspective);
    formData.append('auto_process', autoProcess.toString());

    return this.request('/videos/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async startProcessing(
    videoId: string,
    sampleFps = 2.0,
    layoutId?: string,
    perspective = 'drone_top_down'
  ): Promise<ProcessingJob> {
    return this.request<ProcessingJob>(`/videos/${videoId}/process`, {
      method: 'POST',
      body: JSON.stringify({
        sample_fps: sampleFps,
        layout_id: layoutId,
        camera_perspective: perspective,
      }),
    });
  }

  async getJobStatus(jobOrVideoId: string): Promise<ProcessingJob> {
    return this.request<ProcessingJob>(`/videos/jobs/${jobOrVideoId}`);
  }

  async stopProcessing(jobId: string): Promise<ProcessingJob> {
    return this.request<ProcessingJob>(`/videos/jobs/${jobId}/stop`, {
      method: 'POST',
    });
  }

  // --- Analytics & Predictions ---
  async getDetections(jobOrVideoId: string, ts?: number): Promise<DetectionSummary> {
    const query = ts !== undefined ? `?ts=${ts}` : '';
    return this.request<DetectionSummary>(`/analytics/detections/${jobOrVideoId}${query}`);
  }

  async getHeatmap(jobOrVideoId: string, ts?: number): Promise<HeatmapData> {
    const query = ts !== undefined ? `?ts=${ts}` : '';
    return this.request<HeatmapData>(`/analytics/heatmap/${jobOrVideoId}${query}`);
  }

  async getPredictions(jobOrVideoId: string, horizonSeconds?: number): Promise<PredictionItem[]> {
    const query = horizonSeconds !== undefined ? `?horizon_seconds=${horizonSeconds}` : '';
    return this.request<PredictionItem[]>(`/analytics/predictions/${jobOrVideoId}${query}`);
  }

  async getRisks(jobOrVideoId: string, ts?: number): Promise<RiskItem[]> {
    const query = ts !== undefined ? `?ts=${ts}` : '';
    return this.request<RiskItem[]>(`/analytics/risks?job_id=${jobOrVideoId}${query ? '&' + query.slice(1) : ''}`);
  }

  async getZoneSummary(eventId: string): Promise<EventZoneSummary> {
    return this.request<EventZoneSummary>(`/analytics/zones/${eventId}/summary`);
  }

  // --- Alerts ---
  async getAlerts(eventId?: string, status?: string): Promise<AlertItem[]> {
    const params = new URLSearchParams();
    if (eventId) params.append('event_id', eventId);
    if (status) params.append('status', status);
    return this.request<AlertItem[]>(`/alerts/?${params.toString()}`);
  }

  async updateAlertStatus(alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED'): Promise<AlertItem> {
    return this.request<AlertItem>(`/alerts/${alertId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // --- AI Chat ---
  async sendChatMessage(eventId: string, message: string): Promise<{
    event_id: string;
    response: string;
    timestamp: string;
    reasoning_steps?: string[];
    risk_evaluations?: Record<string, any>;
    recommendations?: string[];
  }> {
    return this.request('/chat/', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, message }),
    });
  }

  // --- Reports ---
  async getReports(eventId?: string): Promise<ReportItem[]> {
    const query = eventId ? `?event_id=${eventId}` : '';
    return this.request<ReportItem[]>(`/reports/${query}`);
  }

  async generateReport(eventId: string, jobId?: string): Promise<ReportItem> {
    return this.request<ReportItem>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, job_id: jobId }),
    });
  }

  async exportReportCsv(reportId: string): Promise<string> {
    return this.request<string>(`/reports/${reportId}/export.csv`);
  }
}

export const api = new ApiService();
