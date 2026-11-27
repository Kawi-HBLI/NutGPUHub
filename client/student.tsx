import { useEffect, useState } from 'react';
import { apiRequest, bangkokToday, formatBangkokDate, formatBangkokTime } from './api';
import { Alert, Button, Card, Input, StatusBadge } from './components';

type Slot = { slotId: number; machineCode: string; startAt: string; endAt: string };
type Booking = Slot & {
  bookingId: number; status: 'confirmed' | 'cancelled' | 'rescheduled'; cancelledAt: string | null;
  replacesBookingId: number | null; replacedByBookingId: number | null;
};
type Slots = { state: 'no-date' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Slot[] };
type MyBookings = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Booking[] };

export function StudentWorkspace() {
  const [date, setDate] = useState(bangkokToday);
  const [slots, setSlots] = useState<Slots>({ state: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [myBookings, setMyBookings] = useState<MyBookings>({ state: 'loading' });
  // F-05: the booking whose cancellation is awaiting confirmation, and the result of the last cancel.
  const [confirming, setConfirming] = useState<number | null>(null);
  const [listNotice, setListNotice] = useState<{ error: boolean; text: string } | null>(null);
  // F-06: the booking being moved, and the target slot awaiting confirmation.
  const [moving, setMoving] = useState<Booking | null>(null);
  const [moveTarget, setMoveTarget] = useState<number | null>(null);

  // F-04 My Bookings: reloaded after every booking attempt so it always matches the server.
  useEffect(() => {
    let active = true;
    void apiRequest<Booking[]>('/bookings').then(result => {
      if (active) setMyBookings(result.ok ? { state: 'ready', data: result.data } : { state: 'error', message: result.error.message });
    });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    // An empty date cannot succeed, so ask for one instead of sending it (#60).
    if (!date) {
      setSlots({ state: 'no-date' });
      return;
    }
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
      setBooking({ ...slot, bookingId: result.data.bookingId, status: 'confirmed', cancelledAt: null, replacesBookingId: null, replacedByBookingId: null });
      history.replaceState(null, '', `?booking=${result.data.bookingId}`);
      setNotice({ error: false, text: 'Your booking is confirmed.' });
    } else {
      setNotice({ error: true, text: result.error.message });
    }
    setPending(false);
    setRefresh(value => value + 1);
  }

  async function cancel(item: Booking) {
    setPending(true);
    setListNotice(null);
    const result = await apiRequest<Booking>(`/bookings/${item.bookingId}/cancel`, { method: 'POST' });
    if (result.ok) {
      setListNotice({ error: false, text: 'Booking cancelled.' });
      setBooking(current => (current?.bookingId === item.bookingId ? result.data : current));
    } else {
      setListNotice({ error: true, text: result.error.message });
    }
    setConfirming(null);
    setPending(false);
    setRefresh(value => value + 1);
  }

  function startMove(item: Booking) {
    setMoving(item);
    setMoveTarget(null);
    setNotice(null);
    setListNotice(null);
    setConfirming(null);
  }

  function stopMove() {
    setMoving(null);
    setMoveTarget(null);
  }

  async function move(slot: Slot) {
    if (!moving) return;
    setPending(true);
    setNotice(null);
    const result = await apiRequest<{ bookingId: number }>(`/bookings/${moving.bookingId}/reschedule`, {
      method: 'POST', body: JSON.stringify({ slotId: slot.slotId }),
    });
    if (result.ok) {
      const saved = await apiRequest<Booking>(`/bookings/${result.data.bookingId}`);
      if (saved.ok) setBooking(saved.data);
      history.replaceState(null, '', `?booking=${result.data.bookingId}`);
      setNotice({ error: false, text: 'Your booking was moved.' });
      setMoving(null);
    } else {
      // The original stays confirmed (BR-03); keep the move open so another slot can be chosen.
      setNotice({ error: true, text: result.error.message });
    }
    setMoveTarget(null);
    setPending(false);
    setRefresh(value => value + 1);
  }

  return <div className="workspace">
    <Card aria-labelledby="available-slots-heading">
      <div className="card-heading"><h2 id="available-slots-heading">Available slots</h2>
        <p>Choose a date and reserve one hour on a GPU machine.</p></div>
      <div className="field date-filter"><label htmlFor="booking-date">Booking date (Bangkok)</label>
        <Input id="booking-date" type="date" value={date} disabled={pending} onChange={event => setDate(event.target.value)} /></div>
      {moving && <div className="form-stack">
        <Alert tone="empty">Moving {moving.machineCode} on {formatBangkokDate(moving.startAt)} at {formatBangkokTime(moving.startAt)}. Choose a new slot.</Alert>
        <Button variant="secondary" disabled={pending} onClick={stopMove}>Stop moving</Button>
      </div>}
      {notice && <Alert tone={notice.error ? 'error' : 'success'}>{notice.text}</Alert>}
      <div className="slot-list" aria-busy={slots.state === 'loading'}>
        {slots.state === 'no-date' && <Alert tone="empty">Choose a date to see available slots.</Alert>}
        {slots.state === 'loading' && <Alert tone="loading">Loading available slots…</Alert>}
        {slots.state === 'error' && <div className="form-stack"><Alert tone="error">{slots.message}</Alert>
          <Button variant="secondary" onClick={() => setRefresh(value => value + 1)}>Try again</Button></div>}
        {slots.state === 'ready' && slots.data.length === 0 && <Alert tone="empty">No available slots on this date.</Alert>}
        {slots.state === 'ready' && <ul className="schedule" aria-label="Available slots">
          {slots.data.map(slot => {
            const time = formatBangkokTime(slot.startAt);
            return <li className="slot-row" key={slot.slotId}>
              <div className="slot-info"><span><strong>{slot.machineCode}</strong> · {time}–{formatBangkokTime(slot.endAt)}</span></div>
              {!moving && <Button disabled={pending} aria-busy={pending} onClick={() => void book(slot)} aria-label={`Book ${slot.machineCode} at ${time}`}>Book</Button>}
              {moving && moveTarget !== slot.slotId && <Button disabled={pending} aria-label={`Move to ${slot.machineCode} at ${time}`}
                onClick={() => { setNotice(null); setMoveTarget(slot.slotId); }}>Move here</Button>}
              {moving && moveTarget === slot.slotId && <div className="booking-actions">
                <Button disabled={pending} aria-busy={pending} onClick={() => void move(slot)}>Confirm move</Button>
                <Button variant="secondary" disabled={pending} onClick={() => setMoveTarget(null)}>Keep current booking</Button>
              </div>}
            </li>;
          })}
        </ul>}
      </div>
    </Card>
    <div className="workspace-column">
      {booking && <Card className="booking-detail" aria-labelledby="saved-booking">
        <BookingBadge booking={booking} />
        <h2 id="saved-booking" className="booking-meta">Saved booking #{booking.bookingId}</h2>
        <p>{booking.machineCode} · {formatBangkokDate(booking.startAt)} · {formatBangkokTime(booking.startAt)}–{formatBangkokTime(booking.endAt)} (Bangkok)</p>
        <a href={`?booking=${booking.bookingId}`}>Open saved booking</a>
      </Card>}
      <Card aria-labelledby="my-bookings">
        <div className="card-heading"><h2 id="my-bookings">My bookings</h2><p>Your saved reservations, ordered by start time.</p></div>
        {myBookings.state === 'loading' && <Alert tone="loading">Loading your bookings…</Alert>}
        {listNotice && <Alert tone={listNotice.error ? 'error' : 'success'}>{listNotice.text}</Alert>}
        {myBookings.state === 'error' && <Alert tone="error">{myBookings.message}</Alert>}
        {myBookings.state === 'ready' && myBookings.data.length === 0 && <Alert tone="empty">You have no bookings yet.</Alert>}
        {myBookings.state === 'ready' && myBookings.data.length > 0 && <ul className="schedule" aria-label="My bookings">
          {myBookings.data.map(item => {
            const label = `${item.machineCode} on ${formatBangkokDate(item.startAt)} at ${formatBangkokTime(item.startAt)}`;
            // The API decides; the UI only offers Cancel and Move while the booking is confirmed and upcoming (AC-26, AC-34).
            const cancellable = item.status === 'confirmed' && new Date(item.startAt).getTime() > Date.now();
            return <li className="slot-row" key={item.bookingId}>
              <div className="slot-info">
                <span><BookingBadge booking={item} /></span>
                <a className="booking-link" href={`?booking=${item.bookingId}`}>
                  {item.machineCode} · {formatBangkokDate(item.startAt)} · {formatBangkokTime(item.startAt)}–{formatBangkokTime(item.endAt)}
                </a>
                {item.cancelledAt && <span>Cancelled at {formatBangkokTime(item.cancelledAt)} on {formatBangkokDate(item.cancelledAt)}</span>}
                {item.replacedByBookingId && <a href={`?booking=${item.replacedByBookingId}`}>New booking #{item.replacedByBookingId}</a>}
                {item.replacesBookingId && <span>Moved from booking #{item.replacesBookingId}</span>}
              </div>
              {cancellable && confirming !== item.bookingId && <div className="booking-actions">
                <Button variant="secondary" disabled={pending || moving?.bookingId === item.bookingId}
                  aria-label={`Move ${label}`} onClick={() => startMove(item)}>Move</Button>
                <Button variant="secondary" disabled={pending}
                  aria-label={`Cancel ${label}`} onClick={() => { stopMove(); setListNotice(null); setConfirming(item.bookingId); }}>Cancel</Button>
              </div>}
              {cancellable && confirming === item.bookingId && <div className="booking-actions">
                <Button disabled={pending} aria-busy={pending} onClick={() => void cancel(item)}>Confirm cancellation</Button>
                <Button variant="secondary" disabled={pending} onClick={() => setConfirming(null)}>Keep booking</Button>
              </div>}
            </li>;
          })}
        </ul>}
      </Card>
    </div>
  </div>;
}

/** Status label for a student booking: cancelled history, a started booking, or a confirmed upcoming one. */
function BookingBadge({ booking }: { booking: Booking }) {
  if (booking.status === 'cancelled') return <StatusBadge tone="past">Cancelled</StatusBadge>;
  if (booking.status === 'rescheduled') return <StatusBadge tone="past">Rescheduled</StatusBadge>;
  if (new Date(booking.startAt).getTime() <= Date.now()) return <StatusBadge tone="past">Started / past</StatusBadge>;
  return <StatusBadge tone="booked">Confirmed</StatusBadge>;
}
