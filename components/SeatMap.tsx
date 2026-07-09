'use client';

import styles from './seat-map.module.css';
import type { SeatBooking, VehicleType } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

interface SeatMapProps {
  vehicleType: VehicleType;
  totalSeats: number;
  seats: SeatBooking[];
  currentUserUid: string;
  currentUserPhotoURL?: string | null;
  onSeatClick: (seatNo: number) => void;
  onUserClick?: (uid: string) => void;
  disabled?: boolean;
  isAdmin?: boolean;
}

interface SeatInfo {
  seatNo: number;
  isDriver: boolean;
  booking: SeatBooking | null;
  isMine: boolean;
  isOccupied: boolean;
}

function buildSeats(totalSeats: number, vehicleType: VehicleType, seats: SeatBooking[], uid: string): SeatInfo[] {
  const bookingMap = new Map(seats.map(s => [s.seatNo, s]));
  const makeSeat = (n: number, isDriver = false): SeatInfo => ({
    seatNo: n,
    isDriver,
    booking: bookingMap.get(n) ?? null,
    isMine: bookingMap.get(n)?.uid === uid,
    isOccupied: bookingMap.has(n),
  });

  const result: SeatInfo[] = [];
  if (vehicleType === 'carry') {
    result.push(makeSeat(1)); // Passenger
    result.push(makeSeat(0, true)); // Driver
    return result;
  }

  // Van or similar
  result.push(makeSeat(1)); // Front left passenger
  result.push(makeSeat(0, true)); // Front right driver
  
  // The rest of the seats (2 onwards)
  for (let i = 2; i <= totalSeats; i++) {
    result.push(makeSeat(i));
  }
  return result;
}

export default function SeatMap({ vehicleType, totalSeats, seats, currentUserUid, currentUserPhotoURL, onSeatClick, onUserClick, disabled, isAdmin }: SeatMapProps) {
  const actualTotalSeats = vehicleType === 'carry' ? 1 : Math.min(totalSeats, 13);
  const allSeats = buildSeats(actualTotalSeats, vehicleType, seats, currentUserUid);
  const occupied = seats.length;
  const available = actualTotalSeats - occupied;

  return (
    <div className={styles.wrapper}>
      {/* Legend */}
      <div className={styles.legend} aria-label="Seat legend">
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.dotAvailable}`} />
          <span>Available ({available})</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.dotMine}`} />
          <span>My seat</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.dotOccupied}`} />
          <span>Occupied</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.dotDriver}`} />
          <span>Driver</span>
        </div>
      </div>

      {/* Vehicle outline & CSS Grid Layout */}
      <div className={styles.vehicle} role="group" aria-label="Seat map">
        <div className={vehicleType === 'carry' ? styles.seatGridCarry : styles.seatGrid}>
          {allSeats.map((seat) => {
            const showProfileClick = isAdmin && seat.isOccupied && seat.booking?.uid;
            const cls = seat.isDriver
              ? styles.seatDriver
              : seat.isMine
              ? styles.seatMine
              : seat.isOccupied
              ? styles.seatOccupied
              : styles.seatAvailable;

            // Handle front row spacing for Van (3 columns: Left Pass, Empty Center, Right Driver)
            const isVanDriver = vehicleType !== 'carry' && seat.isDriver;
            const isVanFrontPass = vehicleType !== 'carry' && seat.seatNo === 1;
            
            const displayPhotoURL = seat.isMine ? (seat.booking?.userPhotoURL || currentUserPhotoURL) : seat.booking?.userPhotoURL;

            return (
              <button
                key={seat.seatNo}
                id={`seat-${seat.seatNo}`}
                className={`${styles.seat} ${cls} ${isVanDriver ? styles.seatPosDriver : ''} ${isVanFrontPass ? styles.seatPosFrontPass : ''}`}
                onClick={() => {
                  if (seat.isDriver) return;
                  if (showProfileClick && onUserClick && seat.booking?.uid) {
                    onUserClick(seat.booking.uid);
                  } else if (!disabled && (!seat.isOccupied || seat.isMine)) {
                    onSeatClick(seat.seatNo);
                  }
                }}
                disabled={seat.isDriver || (!showProfileClick && ((seat.isOccupied && !seat.isMine) || disabled))}
                title={showProfileClick ? (seat.booking?.userFullName || 'View Profile') : (seat.isDriver ? 'Driver' : `Seat ${seat.seatNo}`)}
                style={showProfileClick ? { cursor: 'pointer', transition: 'transform 0.15s ease' } : undefined}
              >
                {displayPhotoURL ? (
                  <img src={displayPhotoURL} alt={seat.booking?.userNickname || 'User'} className={styles.seatPhoto} />
                ) : seat.isDriver ? (
                  <svg className={styles.steeringWheel} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                    <line x1="12" y1="15" x2="12" y2="22"/>
                    <line x1="20" y1="7" x2="14" y2="10.5"/>
                    <line x1="4" y1="7" x2="10" y2="10.5"/>
                  </svg>
                ) : seat.isOccupied ? (
                  <span className={styles.seatInitial}>{seat.booking?.userNickname?.[0] ?? '?'}</span>
                ) : (
                  <span className={styles.seatNumber}>{seat.seatNo}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
