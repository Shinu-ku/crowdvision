import React from 'react';
import {
  Calendar,
  ChevronDown,
  Wifi,
  Bell,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react';
import { EventItem, User } from '../../types';

interface TopbarProps {
  events: EventItem[];
  selectedEvent: EventItem | null;
  onSelectEvent: (event: EventItem) => void;
  currentUser: User | null;
  activeAlertCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  currentUser,
  activeAlertCount = 0,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#070B14]/80 backdrop-blur-md px-6 flex items-center justify-between z-20">
      {/* Event Selector */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 uppercase tracking-wider mb-0.5">
            <Calendar className="h-3 w-3 text-cyan-400" />
            <span>Active Task / Venue</span>
          </div>
          <div className="relative inline-block text-left">
            <select
              aria-label="Active Task / Venue"
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const found = events.find((ev) => ev.id === e.target.value);
                if (found) onSelectEvent(found);
              }}
              className="appearance-none bg-[#0B1120] border border-slate-700/80 hover:border-slate-600 text-white text-sm font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              {events.length === 0 && <option value="">No events configured</option>}
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.event_type})
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {selectedEvent && (
          <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            STATUS: {selectedEvent.status}
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh Analytics"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        )}

        {/* Live Network Stream Status */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Wifi className="h-3.5 w-3.5 animate-pulse" />
          <span>STREAM ONLINE</span>
        </div>

        {/* User Card */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-white">
              {currentUser?.full_name || 'Admin Operator'}
            </div>
            <div className="text-[10px] font-mono text-cyan-400">
              {currentUser?.role || 'ADMIN'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
