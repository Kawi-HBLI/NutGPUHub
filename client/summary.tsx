import { useState, type FormEvent } from 'react';
import { apiRequest, bangkokToday } from './api';
import { Alert, Button, Card, Input, Select } from './components';

type Machine = { machineId: number; machineCode: string };
type Summary = { from: string; to: string; machineId: number | null; open: number; booked: number; bookable: number };
type View = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Summary };

/** F-08 (Deliverable 2 slice): open, booked and bookable counts for a date range on the operator's machines. */
export function SummaryCard({ machines }: { machines: Machine[] }) {
  const [from, setFrom] = useState(bangkokToday);
  const [to, setTo] = useState(bangkokToday);
  // '' = All my machines: the request then omits machineId (contract: an empty machineId is refused).
  const [machine, setMachine] = useState('');
  const [view, setView] = useState<View>({ state: 'idle' });

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setView({ state: 'loading' });
    const query = new URLSearchParams({ from, to });
    if (machine) query.set('machineId', machine);
    const result = await apiRequest<Summary>(`/booking-summary?${query}`);
    setView(result.ok ? { state: 'ready', data: result.data } : { state: 'error', message: result.error.message });
  }

  const label = (id: number | null) => id === null ? 'All my machines' : machines.find(item => item.machineId === id)?.machineCode ?? `Machine ${id}`;

  return (
    <Card aria-labelledby="summary-heading">
      <div className="card-heading"><h2 id="summary-heading">Summary</h2><p>Slot counts for a date range. Bangkok time, both dates included.</p></div>
      <form onSubmit={load} className="form-stack">
        <div className="field"><label htmlFor="summary-from">From</label>
          <Input id="summary-from" type="date" value={from} required onChange={event => setFrom(event.target.value)} /></div>
        <div className="field"><label htmlFor="summary-to">To</label>
          <Input id="summary-to" type="date" value={to} required onChange={event => setTo(event.target.value)} /></div>
        <div className="field"><label htmlFor="summary-machine">Machine</label>
          <Select id="summary-machine" value={machine} onChange={event => setMachine(event.target.value)}>
            <option value="">All my machines</option>
            {machines.map(item => <option key={item.machineId} value={item.machineId}>{item.machineCode}</option>)}
          </Select></div>
        <Button type="submit" disabled={view.state === 'loading'} aria-busy={view.state === 'loading'}>
          {view.state === 'loading' ? 'Loading…' : 'Show summary'}
        </Button>
      </form>
      {view.state === 'error' && <Alert tone="error">{view.message}</Alert>}
      {view.state === 'ready' && (
        <div className="summary-result" aria-live="polite">
          <p className="preview">{label(view.data.machineId)}, {view.data.from} to {view.data.to}</p>
          <dl className="summary-counts">
            <div><dt>Open slots</dt><dd>{view.data.open}</dd></div>
            <div><dt>Booked</dt><dd>{view.data.booked}</dd></div>
            <div><dt>Bookable now</dt><dd>{view.data.bookable}</dd></div>
          </dl>
        </div>
      )}
    </Card>
  );
}
