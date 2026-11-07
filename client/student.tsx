import { useEffect, useState } from 'react';
import { apiRequest, bangkokToday, formatBangkokDate, formatBangkokTime } from './api';

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
    <label htmlFor="booking-date">Booking date (Bangkok)</label>
    <input id="booking-date" type="date" value={date} disabled={pending} onChange={event => setDate(event.target.value)} />
    {notice && <p className={notice.error ? 'error' : 'success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <h2>Available slots</h2>
    {slots.state === 'loading' && <p>Loading available slots…</p>}
    {slots.state === 'error' && <><p className="error" role="alert">{slots.message}</p><button onClick={() => setRefresh(value => value + 1)}>Try again</button></>}
    {slots.state === 'ready' && slots.data.length === 0 && <p>No available slots on this date.</p>}
    {slots.state === 'ready' && <ul className="schedule">
      {slots.data.map(slot => <li key={slot.slotId}>
        <span>{slot.machineCode} · {formatBangkokTime(slot.startAt)}–{formatBangkokTime(slot.endAt)}</span>{' '}
        <button disabled={pending} onClick={() => void book(slot)} aria-label={`Book ${slot.machineCode} at ${formatBangkokTime(slot.startAt)}`}>Book</button>
      </li>)}
    </ul>}
    {booking && <section aria-labelledby="saved-booking">
      <h2 id="saved-booking">Saved booking #{booking.bookingId}</h2>
      <p>{booking.machineCode} · {formatBangkokDate(booking.startAt)} · {formatBangkokTime(booking.startAt)}–{formatBangkokTime(booking.endAt)} (Bangkok)</p>
      <a href={`?booking=${booking.bookingId}`}>Open saved booking</a>
    </section>}
    <section aria-labelledby="my-bookings">
      <h2 id="my-bookings">My bookings</h2>
      {myBookings.state === 'loading' && <p>Loading your bookings…</p>}
      {myBookings.state === 'error' && <p className="error" role="alert">{myBookings.message}</p>}
      {myBookings.state === 'ready' && myBookings.data.length === 0 && <p>You have no bookings yet.</p>}
      {myBookings.state === 'ready' && myBookings.data.length > 0 && <ul className="schedule" aria-label="My bookings">
        {myBookings.data.map(item => <li key={item.bookingId}>
          <a href={`?booking=${item.bookingId}`}>
            {item.machineCode} · {formatBangkokDate(item.startAt)} · {formatBangkokTime(item.startAt)}–{formatBangkokTime(item.endAt)}
          </a>
        </li>)}
      </ul>}
    </section>
  </div>;
}
