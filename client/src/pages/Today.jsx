import { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Check,
  X,
  Ban,
  PartyPopper,
  AlertTriangle,
  Coffee,
  Loader2,
} from 'lucide-react';
import api from '../api/axios.js';

const getTodayLocalISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Today() {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalISO);
  const [schedule, setSchedule] = useState({
    date: getTodayLocalISO(),
    isHoliday: false,
    holidayName: null,
    classes: [],
  });
  const [loading, setLoading] = useState(true);
  const [markingSlotId, setMarkingSlotId] = useState(null);
  const [error, setError] = useState('');

  const fetchTodaySchedule = useCallback(async (dateStr) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/attendance/today?date=${dateStr}`);
      setSchedule(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodaySchedule(selectedDate);
  }, [selectedDate, fetchTodaySchedule]);

  const handleMark = async (cls, status) => {
    if (!cls.subject?._id) return;

    setMarkingSlotId(cls.slotId);
    setError('');
    try {
      await api.post('/attendance/mark', {
        subjectId: cls.subject._id,
        date: schedule.date,
        slotId: cls.slotId,
        status,
      });

      setSchedule((prev) => ({
        ...prev,
        classes: prev.classes.map((item) =>
          item.slotId === cls.slotId ? { ...item, status } : item
        ),
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark attendance.');
    } finally {
      setMarkingSlotId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Daily Attendance
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            One-tap class marking synced with your timetable
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#121418] border border-[#1F242D] rounded-xl px-3.5 py-2 self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-[#1E6BFF]" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-24 rounded-2xl bg-[#121418] border border-[#1F242D] animate-pulse"
            />
          ))}
        </div>
      ) : schedule.isHoliday ? (
        /* Holiday Banner */
        <div className="bg-[#EAB308]/10 border border-[#EAB308]/30 rounded-2xl p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#EAB308]/20 text-[#EAB308]">
            <PartyPopper className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#EAB308]">Official Holiday</h2>
          <p className="text-base font-medium text-white">
            {schedule.holidayName || 'No classes scheduled today'}
          </p>
          <p className="text-xs text-[#9CA3AF]">
            Date: {schedule.date} &bull; Excluded from attendance denominator
          </p>
        </div>
      ) : schedule.classes.length === 0 ? (
        /* Empty Day */
        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-10 text-center space-y-3">
          <Coffee className="w-8 h-8 text-[#9CA3AF] mx-auto" />
          <h2 className="text-lg font-semibold text-white">No Classes Scheduled</h2>
          <p className="text-xs text-[#9CA3AF]">
            There are no timetable slots configured for {schedule.date}. Pick another date to test.
          </p>
        </div>
      ) : (
        /* Scheduled Classes List */
        <div className="space-y-4">
          {schedule.classes.map((cls) => {
            const isMarking = markingSlotId === cls.slotId;

            return (
              <div
                key={cls.slotId}
                className="bg-[#121418] border border-[#1F242D] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:border-[#1E6BFF]/40 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {cls.subject?.code && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#0B0C10] border border-[#1F242D] text-[#1E6BFF]">
                        {cls.subject.code}
                      </span>
                    )}
                    {cls.weight > 1 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#EAB308]/15 text-[#EAB308] border border-[#EAB308]/30">
                        Lab ({cls.weight}x)
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white">
                    {cls.subject?.name || 'Unnamed Subject'}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-[#9CA3AF] flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      {cls.startTime}
                      {cls.endTime ? ` - ${cls.endTime}` : ''}
                    </span>
                    {cls.room && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                        {cls.room}
                      </span>
                    )}
                  </div>
                </div>

                {/* One-Tap Status Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isMarking && (
                    <Loader2 className="w-4 h-4 text-[#1E6BFF] animate-spin mr-1" />
                  )}

                  <button
                    type="button"
                    disabled={isMarking}
                    onClick={() => handleMark(cls, 'PRESENT')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                      cls.status === 'PRESENT'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                        : 'bg-[#0B0C10] text-[#9CA3AF] border-[#1F242D] hover:text-white hover:border-emerald-500/40'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Present
                  </button>

                  <button
                    type="button"
                    disabled={isMarking}
                    onClick={() => handleMark(cls, 'ABSENT')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                      cls.status === 'ABSENT'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-sm shadow-rose-500/10'
                        : 'bg-[#0B0C10] text-[#9CA3AF] border-[#1F242D] hover:text-white hover:border-rose-500/40'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Absent
                  </button>

                  <button
                    type="button"
                    disabled={isMarking}
                    onClick={() => handleMark(cls, 'CANCELLED')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                      cls.status === 'CANCELLED'
                        ? 'bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/50'
                        : 'bg-[#0B0C10] text-[#9CA3AF] border-[#1F242D] hover:text-white hover:border-[#EAB308]/40'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancelled
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
