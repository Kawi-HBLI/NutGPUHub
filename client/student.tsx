import { useEffect, useState } from 'react';
import { apiRequest, bangkokToday, formatBangkokDate, formatBangkokTime } from './api';
import { Alert, Button, Card, Input, StatusBadge } from './components';

type Slot = { slotId: number; machineCode: string; startAt: string; endAt: string };
type Booking = Slot & { bookingId: number };
type Slots = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Slot[] };
type MyBookings = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Booking[] };

export function StudentWorkspace() {
  const [date, setDate] = useState(bangkokToday);
  const [slots, setSlots] = useState<Slots>({ state: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [myBookings, setMyBookings] = useState<MyBookings>({ state: 'loading' });

  // F-04 My Bookings: reloaded after every booking attempt so it always matches the server.
  useEffect(() => {
    let active = true;
    void apiRequest<Booking[]>('/bookings').then(result => {
      if (active) setMyBookings(result.ok ? { state: 'ready', data: result.data } : { state: 'error', message: result.error.message });
    });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    setSlots({ state: 'loading' });
    void apiRequest<Slot[]>(`/slots?date=${encodeURIComponent(date)}`).then(result => {
      if (active) setSlots(result.ok ? { state: 'ready', data: result.data } : { state: 'error', message: result.error.message });
    });
    return () => { active = false; };
  }, [date, refresh]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('booking');
    if (!id) return;
    let active = true;
    void apiRequest<Booking>(`/bookings/${encodeURIComponent(id)}`).then(result => {
      if (!active) return;
      if (result.ok) setBooking(result.data);
      else setNotice({ error: true, text: result.error.message });
    });
    return () => { active = false; };
  }, []);

  async function book(slot: Slot) {
    setPending(true);
    setNotice(null);
    const result = await apiRequest<{ bookingId: number }>('/bookings', {
      method: 'POST', body: JSON.stringify({ slotId: slot.slotId }),
    });
    if (result.ok) {
      setBooking({ ...slot, bookingId: result.data.bookingId });
      history.replaceState(null, '', `?booking=${result.data.bookingId}`);
      setNotice({ error: false, text: 'Your booking is confirmed.' });
    } else {
      setNotice({ error: true, text: result.error.message });
    }
    setPending(false);
    setRefresh(value => value + 1);
  }

  return <div className="workspace">
    <Card aria-labelledby="available-slots-heading">
      <div className="card-heading"><h2 id="available-slots-heading">Available slots</h2>
        <p>Choose a date and reserve one hour on a GPU machine.</p></div>
      <div className="field date-filter"><label htmlFor="booking-date">Booking date (Bangkok)</label>
        <Input id="booking-date" type="date" value={date} disabled={pending} onChange={event => setDate(event.target.value)} /></div>
      {notice && <Alert tone={notice.error ? 'error' : 'success'}>{notice.text}</Alert>}
      <div className="slot-list" aria-busy={slots.state === 'loading'}>
        {slots.state === 'loading' && <Alert tone="loading">Loading available slots…</Alert>}
        {slots.state === 'error' && <div className="form-stack"><Alert tone="error">{slots.message}</Alert>
          <Button variant="secondary" onClick={() => setRefresh(value => value + 1)}>Try again</Button></div>}
        {slots.state === 'ready' && slots.data.length === 0 && <Alert tone="empty">No available slots on this date.</Alert>}
        {slots.state === 'ready' && <ul className="schedule" aria-label="Available slots">
          {slots.data.map(slot => <li className="slot-row" key={slot.slotId}>
            <div className="slot-info"><span><strong>{slot.machineCode}</strong> · {formatBangkokTime(slot.startAt)}–{formatBangkokTime(slot.endAt)}</span></div>
            <Button disabled={pending} aria-busy={pending} onClick={() => void book(slot)} aria-label={`Book ${slot.machineCode} at ${formatBangkokTime(slot.startAt)}`}>Book</Button>
          </li>)}
        </ul>}
      </div>
    </Card>
    <div className="workspace-column">
      {booking && <Card className="booking-detail" aria-labelledby="saved-booking">
        <StatusBadge tone="booked">Confirmed</StatusBadge>
        <h2 id="saved-booking" className="booking-meta">Saved booking #{booking.bookingId}</h2>
        <p>{booking.machineCode} · {formatBangkokDate(booking.startAt)} · {formatBangkokTime(booking.startAt)}–{formatBangkokTime(booking.endAt)} (Bangkok)</p>
        <a href={`?booking=${booking.bookingId}`}>Open saved booking</a>
      </Card>}
      <Card aria-labelledby="my-bookings">
        <div className="card-heading"><h2 id="my-bookings">My bookings</h2><p>Your saved reservations, ordered by start time.</p></div>
        {myBookings.state === 'loading' && <Alert tone="loading">Loading your bookings…</Alert>}
        {myBookings.state === 'error' && <Alert tone="error">{myBookings.message}</Alert>}
        {myBookings.state === 'ready' && myBookings.data.length === 0 && <Alert tone="empty">You have no bookings yet.</Alert>}
        {myBookings.state === 'ready' && myBookings.data.length > 0 && <ul className="schedule" aria-label="My bookings">
          {myBookings.data.map(item => <li key={item.bookingId}>
            <StatusBadge tone={new Date(item.startAt).getTime() <= Date.now() ? 'past' : 'booked'}>
              {new Date(item.startAt).getTime() <= Date.now() ? 'Started / past' : 'Confirmed'}</StatusBadge>
            <a className="booking-link" href={`?booking=${item.bookingId}`}>
              {item.machineCode} · {formatBangkokDate(item.startAt)} · {formatBangkokTime(item.startAt)}–{formatBangkokTime(item.endAt)}
            </a>
          </li>)}
        </ul>}
      </Card>
    </div>
  </div>;
}
