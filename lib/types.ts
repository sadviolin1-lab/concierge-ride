// ────────────────────────────────────────────────────────────────────────────
// Concierge Ride — Core Types
// ────────────────────────────────────────────────────────────────────────────

export type UserRole = 'staff' | 'driver' | 'admin' | 'master_admin' | 'hr';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export type UserPurpose = 'shuttle' | 'request' | 'both' | 'driver';

export interface UserProfile {
  uid: string;
  email: string;        // system-generated, not shown to user
  phone: string;        // E.164 format, e.g. +66812345678
  fullName: string;
  nickname: string;
  employeeId: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  photoURL: string | null;
  purpose?: UserPurpose;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
  suspendedUntil?: number;   // timestamp for auto-unsuspend
  accountExpiresAt?: number; // timestamp for temporary account expiry
}


// ── Vehicles ─────────────────────────────────────────────────────────────────

export type VehicleType = 'carry' | 'pickup' | 'van';

export interface Vehicle {
  id: string;
  type: VehicleType;
  name: string;
  licensePlate: string;
  totalSeats: number; // includes driver seat
  passengerSeats: number; // excludes driver seat
  description: string;
  isActive: boolean;
}

export const VEHICLE_CONFIGS: Record<VehicleType, Omit<Vehicle, 'id' | 'licensePlate' | 'isActive'>> = {
  carry: {
    type: 'carry',
    name: 'Suzuki Carry',
    totalSeats: 2,
    passengerSeats: 1,
    description: 'For cargo / bakery transport',
  },
  pickup: {
    type: 'pickup',
    name: 'Pickup Truck',
    totalSeats: 13,
    passengerSeats: 13,
    description: '13-seat pickup for staff shuttle',
  },
  van: {
    type: 'van',
    name: 'Van',
    totalSeats: 13,
    passengerSeats: 13,
    description: '13-seat van for staff shuttle',
  },
};

// ── Shuttle / Seat Booking ────────────────────────────────────────────────────

export type ShiftType = 'morning' | 'day' | 'afternoon';

export interface SeatBooking {
  seatNo: number;
  uid: string;
  userFullName: string;
  userNickname: string;
  userPhotoURL: string | null;
  bookedAt: number;
  direction: 'inbound' | 'outbound' | 'roundtrip';
  location: 'dormitory' | 'kathu';
  inboundCheckedIn?: boolean;
  outboundCheckedIn?: boolean;
}

export interface ShuttleRide {
  id: string;            // format: YYYY-MM-DD_shift
  date: string;          // YYYY-MM-DD
  shift: ShiftType;
  shiftLabel: string;
  vehicleType: VehicleType;
  vehicleId: string;
  driverUid: string | null;
  seats: SeatBooking[];  // occupied seats only
  totalSeats: number;
  inboundVehicleType?: VehicleType;
  inboundVehicleId?: string;
  inboundTotalSeats?: number;
  outboundVehicleType?: VehicleType;
  outboundVehicleId?: string;
  outboundTotalSeats?: number;
  availableLocations?: ('dormitory' | 'kathu')[]; // Default to just ['dormitory'] if missing
  isClosed?: boolean;
  isForceOpened?: boolean;
  createdAt: number;
  updatedAt: number;
  inboundRollCallCompletedAt?: number;
  outboundRollCallCompletedAt?: number;
}

// ── General Requests ─────────────────────────────────────────────────────────

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'in_progress' | 'completed';
export type RequestType = 'document' | 'parcel' | 'errand' | 'other';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Destination {
  id?: string;
  address: string;
  latLng: LatLng | null;
  title?: string;
  description?: string;
  hasPassengers?: boolean;
  passengerCount?: number;
  passengerName?: string;
  passengerContact?: string;
}

export interface GeneralRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterDepartment: string;
  requesterPhotoURL: string | null;
  type: RequestType;
  typeLabel: string;
  title: string;
  description: string;
  destination: string;        // text description (Main/First destination)
  destinationLatLng: LatLng | null;
  destinations?: Destination[]; // Optional: List of multiple stops
  requestedDate: string;      // YYYY-MM-DD
  requestedTime: string;      // HH:MM
  status: RequestStatus;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewNote: string | null;
  rescheduledDate: string | null;
  startedAt?: number;
  startedByUid?: string | null;
  startedByName?: string | null;
  completedAt?: number;
  completionNote?: string | null;
  completionPhotoURL?: string | null;
  contactType?: 'self' | 'other';
  contactName?: string;
  contactPhone?: string;
  isEdited?: boolean;
  editedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface DepartmentStat {
  department: string;
  shuttleCount: number;
  requestCount: number;
  total: number;
}

export interface MonthlyReport {
  month: string;           // YYYY-MM
  totalShuttleBookings: number;
  totalRequests: number;
  byDepartment: DepartmentStat[];
  byRequestType: Record<RequestType, number>;
}
