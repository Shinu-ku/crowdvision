import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { DashboardView } from './views/DashboardView';
import { TaskAnalysisView } from './views/TaskAnalysisView';
import { TasksListView } from './views/TasksListView';
import { LayoutBuilder } from './components/layout_builder/LayoutBuilder';
import { PredictionViewer } from './components/predictions/PredictionViewer';
import { AlertsPanel } from './components/alerts/AlertsPanel';
import { CrowdAnalystChat } from './components/chat/CrowdAnalystChat';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './views/SettingsView';
import { CreateTaskModal } from './views/CreateTaskModal';

import {
  EventItem,
  Venue,
  LayoutZoneData,
  AlertItem,
  EventZoneSummary,
  User,
  PredictionItem,
} from './types';
import { api } from './services/api';
import { wsClient } from './services/websocket';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activeZones, setActiveZones] = useState<LayoutZoneData[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [zoneSummary, setZoneSummary] = useState<EventZoneSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize Auth & Initial Data
  useEffect(() => {
    const initApp = async () => {
      try {
        // Auto-login to obtain bearer token if not logged in
        if (!api.getToken()) {
          await api.login();
        }
        const user = await api.getMe().catch(() => null);
        if (user) setCurrentUser(user);

        // Load events and venues
        const [evs, vns] = await Promise.all([
          api.getEvents().catch(() => []),
          api.getVenues().catch(() => []),
        ]);

        setEvents(evs);
        setVenues(vns);

        if (evs.length > 0) {
          setSelectedEvent(evs[0]);
        }
      } catch {
        // ignore
      }
    };
    initApp();
  }, []);

  // When selected event changes, load its zones, alerts, summaries, and connect WebSocket
  useEffect(() => {
    if (!selectedEvent) return;

    const loadEventData = async () => {
      setIsRefreshing(true);
      try {
        const [layouts, alts, summary, preds] = await Promise.all([
          api.getLayouts(selectedEvent.venue_id).catch(() => []),
          api.getAlerts(selectedEvent.id).catch(() => []),
          api.getZoneSummary(selectedEvent.id).catch(() => null),
          api.getPredictions(selectedEvent.id).catch(() => []),
        ]);

        setAlerts(alts);
        if (summary) setZoneSummary(summary);
        if (preds) setPredictions(preds);

        if (layouts.length > 0 && layouts[0].zones_data) {
          setActiveZones(layouts[0].zones_data);
        } else {
          // Default fallbacks if no layout has been drawn yet
          setActiveZones([
            {
              id: 'zone-stage',
              name: 'Main Stage',
              zone_type: 'STAGE',
              polygon_points: [
                { x: 0.1, y: 0.1 },
                { x: 0.9, y: 0.1 },
                { x: 0.9, y: 0.45 },
                { x: 0.1, y: 0.45 },
              ],
              capacity: 250,
              color: '#06B6D4',
            },
            {
              id: 'zone-exit',
              name: 'South Exit Corridor',
              zone_type: 'EXIT',
              polygon_points: [
                { x: 0.1, y: 0.55 },
                { x: 0.9, y: 0.55 },
                { x: 0.9, y: 0.9 },
                { x: 0.1, y: 0.9 },
              ],
              capacity: 150,
              color: '#3B82F6',
            },
          ]);
        }
      } finally {
        setIsRefreshing(false);
      }
    };

    loadEventData();

    // Connect WebSocket
    wsClient.connect(selectedEvent.id);
    const unsubscribe = wsClient.subscribe((data) => {
      if (data.alerts && data.alerts.length > 0) {
        setAlerts((prev) => [...data.alerts, ...prev]);
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [selectedEvent?.id]);

  const handleRefreshAll = async () => {
    if (!selectedEvent) return;
    setIsRefreshing(true);
    try {
      const [alts, summary, preds] = await Promise.all([
        api.getAlerts(selectedEvent.id).catch(() => []),
        api.getZoneSummary(selectedEvent.id).catch(() => null),
        api.getPredictions(selectedEvent.id).catch(() => []),
      ]);
      setAlerts(alts);
      if (summary) setZoneSummary(summary);
      if (preds) setPredictions(preds);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTaskCreated = async (newEventId: string) => {
    const updated = await api.getEvents().catch(() => []);
    setEvents(updated);
    const created = updated.find((ev) => ev.id === newEventId);
    if (created) {
      setSelectedEvent(created);
      setCurrentTab('monitoring');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070B14]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenCreateTask={() => setIsCreateTaskOpen(true)}
        alertCount={alerts.filter((a) => a.status === 'ACTIVE').length}
        agentStatus="connected"
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <Topbar
          events={events}
          selectedEvent={selectedEvent}
          onSelectEvent={(ev) => setSelectedEvent(ev)}
          currentUser={currentUser}
          activeAlertCount={alerts.filter((a) => a.status === 'ACTIVE').length}
          onRefresh={handleRefreshAll}
          isRefreshing={isRefreshing}
        />

        {/* Page Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {currentTab === 'dashboard' && (
            <DashboardView
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => setSelectedEvent(ev)}
              onNavigateToMonitoring={() => setCurrentTab('monitoring')}
              onOpenCreateTask={() => setIsCreateTaskOpen(true)}
              alerts={alerts}
              zoneSummary={zoneSummary}
            />
          )}

          {currentTab === 'monitoring' && selectedEvent && (
            <TaskAnalysisView
              event={selectedEvent}
              zones={activeZones}
              onOpenLayoutBuilder={() => setCurrentTab('layout-builder')}
              onOpenChat={() => setCurrentTab('chat')}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksListView
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => setSelectedEvent(ev)}
              onNavigateToMonitoring={() => setCurrentTab('monitoring')}
              onNavigateToReports={() => setCurrentTab('reports')}
              onOpenCreateTask={() => setIsCreateTaskOpen(true)}
            />
          )}

          {currentTab === 'layout-builder' && selectedEvent && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Custom Layout Builder & Spatial Zone Geometries
                  </h2>
                  <p className="text-xs text-slate-400">
                    Construct virtual polygon barriers, turnstiles, and stage areas.
                  </p>
                </div>
              </div>
              <LayoutBuilder
                venueId={selectedEvent.venue_id || 'venue_default'}
                initialZones={activeZones}
                onSaved={async () => {
                  if (selectedEvent.venue_id) {
                    const l = await api.getLayouts(selectedEvent.venue_id).catch(() => []);
                    if (l.length > 0 && l[0].zones_data) {
                      setActiveZones(l[0].zones_data);
                    }
                  }
                }}
              />
            </div>
          )}

          {currentTab === 'predictions' && (
            <div className="space-y-4">
              <PredictionViewer predictions={predictions} />
            </div>
          )}

          {currentTab === 'alerts' && (
            <AlertsPanel
              alerts={alerts}
              onAlertUpdated={handleRefreshAll}
            />
          )}

          {currentTab === 'chat' && selectedEvent && (
            <CrowdAnalystChat eventId={selectedEvent.id} />
          )}

          {currentTab === 'reports' && selectedEvent && (
            <ReportsView eventId={selectedEvent.id} />
          )}

          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        venues={venues}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
};

export default App;
