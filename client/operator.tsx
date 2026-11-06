import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest, bangkokToday, formatBangkokTime } from './api';

type Machine = { machineId: number; machineCode: string };
type Slot = { slotId: number; machineId: number; startAt: string; endAt: string };
type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T };

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

/** F-02: operator machine list, day schedule and slot creation. */
export function OperatorWorkspace() {
  const [machines, setMachines] = useState<Load<Machine[]>>({ state: 'loading' });
  const [machineId, setMachineId] = useState<number | null>(null);
  const [date, setDate] = useState(bangkokToday);
  const [hour, setHour] = useState('09');
  const [slots, setSlots] = useState<Load<Slot[]>>({ state: 'loading' });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    void apiRequest<Machine[]>('/machines').then((result) => {
      if (!result.ok) {
        setMachines({ state: 'error', message: result.error.message });
        return;
      }
      setMachines({ state: 'ready', data: result.data });
      setMachineId(result.data[0]?.machineId ?? null);
    });
  }, []);

  const loadSchedule = useCallback(async () => {
    if (machineId === null || !date) return;
    setSlots({ state: 'loading' });
    const result = await apiRequest<Slot[]>(`/machines/${machineId}/slots?date=${encodeURIComponent(date)}`);
    setSlots(result.ok ? { state: 'ready', data: result.data } : { state: 'error', message: result.error.message });
  }, [machineId, date]);

  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  async function openSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (machineId === null) return;
    setPending(true);
    setNotice(null);
    const result = await apiRequest<Slot>(`/machines/${machineId}/slots`, {
      method: 'POST',
      body: JSON.stringify({ startAt: `${date}T${hour}:00:00+07:00` }),
    });
    setPending(false);
    if (result.ok) {
      setNotice({ kind: 'success', text: `Opened ${formatBangkokTime(result.data.startAt)}–${formatBangkokTime(result.data.endAt)}.` });
      await loadSchedule();
    } else {
      // Keep the selected date and hour so the operator can correct the request.
      setNotice({ kind: 'error', text: result.error.message });
    }
  }

  if (machines.state === 'loading') return <p>Loading your machines…</p>;
  if (machines.state === 'error') return <p className="error" role="alert">{machines.message}</p>;
  if (machines.data.length === 0) return <p>No GPU machines are assigned to you yet.</p>;

  const endHour = String((Number(hour) + 1) % 24).padStart(2, '0');

  return (
    <div className="workspace">
      <form onSubmit={openSlot} className="slot-form">
        <label htmlFor="machine">Machine</label>
        <select id="machine" value={machineId ?? ''} onChange={event => setMachineId(Number(event.target.value))}>
          {machines.data.map(machine => <option key={machine.machineId} value={machine.machineId}>{machine.machineCode}</option>)}
        </select>
        <label htmlFor="date">Date</label>
        <input id="date" type="date" value={date} required onChange={event => setDate(event.target.value)} />
        <label htmlFor="hour">Start time</label>
        <select id="hour" value={hour} onChange={event => setHour(event.target.value)}>
          {hours.map(value => <option key={value} value={value}>{value}:00</option>)}
        </select>
        <p className="preview" aria-live="polite">Slot: {hour}:00–{endHour}:00, Bangkok time</p>
        {notice && <p className={notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        <button disabled={pending || !date}>{pending ? 'Opening…' : 'Open slot'}</button>
      </form>

      <section aria-labelledby="schedule-heading">
        <h2 id="schedule-heading">Schedule for {date}</h2>
        {slots.state === 'loading' && <p>Loading schedule…</p>}
        {slots.state === 'error' && <p className="error" role="alert">{slots.message}</p>}
        {slots.state === 'ready' && slots.data.length === 0 && <p>No slots on this date.</p>}
        {slots.state === 'ready' && slots.data.length > 0 && (
          <ul className="schedule">
            {slots.data.map(slot => (
              <li key={slot.slotId}>{formatBangkokTime(slot.startAt)}–{formatBangkokTime(slot.endAt)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
