import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest, bangkokToday, formatBangkokTime } from './api';
import { Alert, Button, Card, Input, Select, StatusBadge, Table } from './components';

type Machine = { machineId: number; machineCode: string };
type Slot = {
  slotId: number; machineId: number; startAt: string; endAt: string;
  booking: { bookingId: number; studentUsername: string } | null;
};
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

  if (machines.state === 'loading') return <Card><Alert tone="loading">Loading your machines…</Alert></Card>;
  if (machines.state === 'error') return <Card><Alert tone="error">{machines.message}</Alert></Card>;
  if (machines.data.length === 0) return <Card><Alert tone="empty">No GPU machines are assigned to you yet.</Alert></Card>;

  const endHour = String((Number(hour) + 1) % 24).padStart(2, '0');

  return (
    <div className="workspace operator-workspace">
      <Card aria-labelledby="open-slot-heading">
        <div className="card-heading"><h2 id="open-slot-heading">Open a slot</h2><p>Publish a one-hour slot on an assigned machine.</p></div>
        <form onSubmit={openSlot} className="form-stack">
          <div className="field"><label htmlFor="machine">Machine</label>
            <Select id="machine" value={machineId ?? ''} onChange={event => setMachineId(Number(event.target.value))}>
              {machines.data.map(machine => <option key={machine.machineId} value={machine.machineId}>{machine.machineCode}</option>)}
            </Select></div>
          <div className="field"><label htmlFor="date">Date</label>
            <Input id="date" type="date" value={date} required onChange={event => setDate(event.target.value)} /></div>
          <div className="field"><label htmlFor="hour">Start time</label>
            <Select id="hour" value={hour} onChange={event => setHour(event.target.value)}>
              {hours.map(value => <option key={value} value={value}>{value}:00</option>)}
            </Select></div>
          <p className="preview" aria-live="polite">Slot: {hour}:00–{endHour}:00, Bangkok time</p>
          {notice && <Alert tone={notice.kind}>{notice.text}</Alert>}
          <Button type="submit" disabled={pending || !date} aria-busy={pending}>{pending ? 'Opening…' : 'Open slot'}</Button>
        </form>
      </Card>
      <Card aria-labelledby="schedule-heading">
        <div className="card-heading"><h2 id="schedule-heading">Schedule for {date}</h2><p>Bookings and open slots for the selected machine. Bangkok time.</p></div>
        {slots.state === 'loading' && <Alert tone="loading">Loading schedule…</Alert>}
        {slots.state === 'error' && <Alert tone="error">{slots.message}</Alert>}
        {slots.state === 'ready' && slots.data.length === 0 && <Alert tone="empty">No slots on this date.</Alert>}
        {slots.state === 'ready' && slots.data.length > 0 && (
          <Table caption={`Slots and reservations for ${date}`}>
            <thead><tr><th scope="col">Time and reservation</th></tr></thead>
            <tbody>{slots.data.map(slot => (
              <tr key={slot.slotId}><td><div className="schedule-summary">
                {formatBangkokTime(slot.startAt)}–{formatBangkokTime(slot.endAt)} ·{' '}
                {slot.booking
                  ? <><StatusBadge tone="booked">Booked by <strong>{slot.booking.studentUsername}</strong></StatusBadge><small>(booking #{slot.booking.bookingId})</small></>
                  : <StatusBadge tone={new Date(slot.startAt).getTime() <= Date.now() ? 'past' : 'available'}>
                    {new Date(slot.startAt).getTime() <= Date.now() ? 'Started / past' : 'Available'}</StatusBadge>}
              </div></td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
