'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import SeatMap from '@/components/SeatMap';
import type { ShuttleRide, VehicleType, SeatBooking, Vehicle, ShiftType, UserProfile } from '@/lib/types';
import { VEHICLE_CONFIGS } from '@/lib/types';
import styles from './shuttle.module.css';

const SHIFTS = {
  en: [
    { key: 'morning',   label: 'Morning Shift',   time: '05:30 – 15:30' },
    { key: 'day',       label: 'Day Shift',       time: '08:00 – 18:00' },
    { key: 'afternoon', label: 'Afternoon Shift', time: '14:00 – 00:00' },
  ],
  th: [
    { key: 'morning',   label: 'กะเช้า (Morning)',   time: '05:30 – 15:30' },
    { key: 'day',       label: 'กะกลางวัน (Day)',     time: '08:00 – 18:00' },
    { key: 'afternoon', label: 'กะบ่าย (Afternoon)',  time: '14:00 – 00:00' },
  ]
} as const;

const LANG = {
  en: {
    title: 'Staff Shuttle Booking',
    subtitle: 'Select a date and shift',
    dateLabel: 'Date',
    loading: 'Loading shift data…',
    noRideTitle: 'No vehicle assigned for this shift',
    driverHint: 'As a driver, you can assign a vehicle to open booking for this shift.',
    staffHint: 'Please check back later or contact the Concierge team.',
    vehType: 'Select Vehicle',
    assignVeh: 'Assign Vehicle & Open Booking',
    assigning: 'Assigning…',
    seatsTaken: 'seats taken',
    cancelHint: 'You have seat {seatNo}. Click your seat to cancel, or another seat to move.',
    bookHint: 'Click an available seat to book it.',
    seatBooked: 'Seat {seatNo} booked',
    msgAssigned: 'Vehicle assigned successfully!',
    msgAssignFail: 'Failed to assign vehicle. Please try again.',
    msgCancel: 'Your booking has been cancelled.',
    msgMoved: 'Moved to seat {seatNo}.',
    msgBooked: 'Seat {seatNo} booked! See you on the shuttle. 🚌',
    msgBookFail: 'Booking failed. Please try again.',
    modalTitleBook: 'Confirm Booking',
    modalBodyBook: 'Are you sure you want to book seat {seatNo}?',
    modalTitleMove: 'Move Seat',
    modalBodyMove: 'Are you sure you want to move to seat {seatNo}?',
    modalTitleCancel: 'Cancel Booking',
    modalBodyCancel: 'Are you sure you want to cancel your booking for seat {seatNo}?',
    modalBtnCancel: 'No, keep it',
    modalBtnConfirm: 'Yes, confirm',
    shiftLabel: 'Shift',
  },
  th: {
    title: 'จองรถรับส่งพนักงาน',
    subtitle: 'เลือกวันที่ และกะการทำงาน',
    dateLabel: 'วันที่',
    loading: 'กำลังโหลดข้อมูลกะ…',
    noRideTitle: 'ยังไม่มีการจัดรถสำหรับกะนี้',
    driverHint: 'ในฐานะคนขับรถ คุณสามารถเลือกรถเพื่อเปิดให้จองสำหรับกะนี้ได้',
    staffHint: 'กรุณาตรวจสอบอีกครั้งในภายหลัง หรือติดต่อทีม Concierge',
    vehType: 'เลือกรถที่จะขับ',
    assignVeh: 'จัดรถและเปิดให้จอง',
    assigning: 'กำลังจัดรถ…',
    seatsTaken: 'ที่นั่งถูกจองแล้ว',
    cancelHint: 'คุณได้ที่นั่ง {seatNo}. คลิกที่นั่งของคุณเพื่อยกเลิก หรือคลิกที่อื่นเพื่อย้าย',
    bookHint: 'คลิกที่นั่งที่ว่างเพื่อจอง',
    seatBooked: 'จองที่นั่ง {seatNo} แล้ว',
    msgAssigned: 'จัดรถสำเร็จ!',
    msgAssignFail: 'จัดรถไม่สำเร็จ กรุณาลองใหม่',
    msgCancel: 'ยกเลิกการจองเรียบร้อยแล้ว',
    msgMoved: 'ย้ายไปที่นั่ง {seatNo} แล้ว',
    msgBooked: 'จองที่นั่ง {seatNo} สำเร็จ! เจอกันบนรถครับ 🚌',
    msgBookFail: 'จองไม่สำเร็จ กรุณาลองใหม่',
    modalTitleBook: 'ยืนยันการจอง',
    modalBodyBook: 'คุณแน่ใจหรือไม่ว่าต้องการจองที่นั่ง {seatNo}?',
    modalTitleMove: 'ย้ายที่นั่ง',
    modalBodyMove: 'คุณแน่ใจหรือไม่ว่าต้องการย้ายไปที่นั่ง {seatNo}?',
    modalTitleCancel: 'ยกเลิกการจอง',
    modalBodyCancel: 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองที่นั่ง {seatNo}?',
    modalBtnCancel: 'ปิด',
    modalBtnConfirm: 'ใช่, ยืนยัน',
    shiftLabel: 'กะการทำงาน',
  }
} as const;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rideId(date: string, shift: string) {
  return `${date}_${shift}`;
}

function formatDateLong(dateStr: string, lang: 'en' | 'th') {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const monthIdx = parseInt(m, 10) - 1;
  const thMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const enMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  if (lang === 'th') {
    const thYear = parseInt(y, 10) + 543;
    return `${parseInt(d, 10)} ${thMonths[monthIdx]} ${thYear}`;
  } else {
    return `${parseInt(d, 10)} ${enMonths[monthIdx]} ${y}`;
  }
}

function ShuttlePageInner() {
  const { userProfile, isMasterAdmin } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const driverBookMode = searchParams.get('mode') === 'book';
  const t = LANG[lang];
  const shifts = SHIFTS[lang];

  const defaultLocationsForShift = (shift: ShiftType): ('dormitory' | 'kathu')[] => {
    return shift === 'day' ? ['dormitory'] : ['dormitory', 'kathu'];
  };

  const [selectedDate, setSelectedDate] = useState(tomorrowStr());
  const [selectedShift, setSelectedShift] = useState<ShiftType>('morning');
  const [ride, setRide] = useState<ShuttleRide | null>(null);
  const [loadingRide, setLoadingRide] = useState(false);
  const [booking, setBooking] = useState(false);
  const renderRide = ride || { 
    id: '', 
    shift: selectedShift, 
    date: selectedDate, 
    seats: [], 
    availableLocations: defaultLocationsForShift(selectedShift), 
    isClosed: false, 
    isForceOpened: false 
  } as unknown as ShuttleRide;
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; seatNo: number | null; action: 'book' | 'cancel' | 'move' | null }>({ isOpen: false, seatNo: null, action: null });

  // Admin/Driver state
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [selectedInboundVehicleId, setSelectedInboundVehicleId] = useState<string>('');
  const [selectedOutboundVehicleId, setSelectedOutboundVehicleId] = useState<string>('');
  const [assignLocations, setAssignLocations] = useState<('dormitory' | 'kathu')[]>(['dormitory', 'kathu']);

  // Booking form state
  const [bookingDirection, setBookingDirection] = useState<'inbound' | 'outbound' | 'roundtrip'>('inbound');
  const [bookingLocation, setBookingLocation] = useState<'dormitory' | 'kathu'>('dormitory');
  const [viewDirection, setViewDirection] = useState<'inbound' | 'outbound'>('inbound');

  useEffect(() => {
    setAssignLocations(defaultLocationsForShift(selectedShift));
    if (selectedShift === 'day') {
      setBookingLocation('dormitory');
    }
  }, [selectedShift]);

  // Roll-Call state
  const [isRollCallModalOpen, setIsRollCallModalOpen] = useState(false);
  const [rollCallLeg, setRollCallLeg] = useState<'inbound' | 'outbound'>('inbound');
  const [localRollCallState, setLocalRollCallState] = useState<Record<number, boolean>>({});
  const [selectedSeatForProfile, setSelectedSeatForProfile] = useState<SeatBooking | null>(null);
  const [selectedSeatProfileData, setSelectedSeatProfileData] = useState<UserProfile | null>(null);
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);

  // Time and Booking Window State
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [shuttleDefaults, setShuttleDefaults] = useState<Record<ShiftType, { inbound: VehicleType; outbound: VehicleType }>>({
    morning: { inbound: 'pickup', outbound: 'pickup' },
    day: { inbound: 'van', outbound: 'van' },
    afternoon: { inbound: 'van', outbound: 'van' }
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'shuttle'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.defaults) {
          const parsed: any = {};
          const shiftsKeys: ShiftType[] = ['morning', 'day', 'afternoon'];
          shiftsKeys.forEach(k => {
            if (typeof data.defaults[k] === 'string') {
              parsed[k] = { inbound: data.defaults[k], outbound: data.defaults[k] };
            } else if (data.defaults[k]) {
              parsed[k] = { 
                inbound: data.defaults[k].inbound || 'van', 
                outbound: data.defaults[k].outbound || 'van' 
              };
            } else {
              parsed[k] = k === 'morning' ? { inbound: 'pickup', outbound: 'pickup' } : { inbound: 'van', outbound: 'van' };
            }
          });
          setShuttleDefaults(parsed);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate booking window for selectedDate
  // Open 1 day before selectedDate from 08:00 to 18:00
  const targetDateObj = new Date(selectedDate + 'T00:00:00');
  const bookingDateObj = new Date(targetDateObj);
  bookingDateObj.setDate(bookingDateObj.getDate() - 1); // 1 day before

  const openTimeObj = new Date(bookingDateObj);
  openTimeObj.setHours(8, 0, 0, 0);
  const openTime = openTimeObj.getTime();

  const closeTimeObj = new Date(bookingDateObj);
  closeTimeObj.setHours(18, 0, 0, 0);
  const closeTime = closeTimeObj.getTime();

  const isForceOpened = ride?.isForceOpened === true;
  const isBookingWindowOpen = isForceOpened || (currentTime >= openTime && currentTime <= closeTime);
  const isBookingPast = !isForceOpened && currentTime > closeTime;
  const isBeforeBooking = !isForceOpened && currentTime < openTime;
  const timeRemainingMs = (isBookingWindowOpen && !isForceOpened) ? closeTime - currentTime : 0;
  const timeUntilOpenMs = isBeforeBooking ? openTime - currentTime : 0;

  const formatTimeRemaining = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    setLoadingRide(true);
    setMessage(null);
    const id = rideId(selectedDate, selectedShift);
    
    const unsubscribe = onSnapshot(doc(db, 'shuttleRides', id), (snap) => {
      if (snap.exists()) {
        setRide(snap.data() as ShuttleRide);
      } else {
        const defInbound = shuttleDefaults[selectedShift]?.inbound || (selectedShift === 'morning' ? 'pickup' : 'van');
        const defOutbound = shuttleDefaults[selectedShift]?.outbound || (selectedShift === 'morning' ? 'pickup' : 'van');
        const defaultRide: ShuttleRide = {
          id,
          date: selectedDate,
          shift: selectedShift,
          shiftLabel: shifts.find(s => s.key === selectedShift)?.label ?? selectedShift,
          vehicleType: defInbound,
          vehicleId: '', 
          driverUid: null,
          seats: [],
          inboundVehicleType: defInbound,
          outboundVehicleType: defOutbound,
          totalSeats: VEHICLE_CONFIGS[defInbound].totalSeats,
          availableLocations: defaultLocationsForShift(selectedShift),
          isClosed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setRide(defaultRide);
      }
      setLoadingRide(false);
    }, (error) => {
      console.error(error);
      setLoadingRide(false);
    });

    return () => unsubscribe();
  }, [selectedDate, selectedShift, shifts, shuttleDefaults]);

  const fetchVehicles = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'vehicles'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)).filter(v => v.isActive);
      setAvailableVehicles(list);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (availableVehicles.length > 0) {
      const defaultInbound = shuttleDefaults[selectedShift]?.inbound || (selectedShift === 'morning' ? 'pickup' : 'van');
      const defaultOutbound = shuttleDefaults[selectedShift]?.outbound || (selectedShift === 'morning' ? 'pickup' : 'van');
      
      const inboundVehs = availableVehicles.filter(v => v.type === defaultInbound);
      const inboundDefault = inboundVehs.length > 0 ? inboundVehs[0].id : availableVehicles[0].id;
      setSelectedInboundVehicleId(inboundDefault);
      
      const outboundVehs = availableVehicles.filter(v => v.type === defaultOutbound);
      const outboundDefault = outboundVehs.length > 0 ? outboundVehs[0].id : availableVehicles[0].id;
      setSelectedOutboundVehicleId(outboundDefault);
    }
  }, [selectedShift, availableVehicles, shuttleDefaults]);

  useEffect(() => { 
    if (userProfile?.role === 'driver' || userProfile?.role === 'admin' || userProfile?.role === 'master_admin') {
      fetchVehicles(); 
    }
  }, [userProfile?.role, fetchVehicles]);

  const handleAssignVehicle = async () => {
    if (!userProfile || !selectedInboundVehicleId || !selectedOutboundVehicleId) return;
    
    const inboundVeh = availableVehicles.find(v => v.id === selectedInboundVehicleId);
    const outboundVeh = availableVehicles.find(v => v.id === selectedOutboundVehicleId);
    if (!inboundVeh || !outboundVeh) return;

    setBooking(true);
    try {
      const id = rideId(selectedDate, selectedShift);
      const now = Date.now();
      const newRide: ShuttleRide = {
        id,
        date: selectedDate,
        shift: selectedShift,
        shiftLabel: shifts.find(s => s.key === selectedShift)?.label ?? selectedShift,
        
        vehicleType: inboundVeh.type,
        vehicleId: inboundVeh.id,
        totalSeats: inboundVeh.totalSeats,
        
        inboundVehicleType: inboundVeh.type,
        inboundVehicleId: inboundVeh.id,
        inboundTotalSeats: inboundVeh.totalSeats,
        
        outboundVehicleType: outboundVeh.type,
        outboundVehicleId: outboundVeh.id,
        outboundTotalSeats: outboundVeh.totalSeats,
        
        driverUid: userProfile.uid,
        seats: [],
        availableLocations: assignLocations.length > 0 ? assignLocations : ['dormitory'],
        isClosed: false,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'shuttleRides', id), newRide);
      setRide(newRide);
      setMessage({ text: t.msgAssigned, type: 'success' });
    } catch (err: any) {
      console.error(err);
      setMessage({ text: t.msgAssignFail, type: 'error' });
    } finally {
      setBooking(false);
    }
  };

  const handleAutoBook = () => {
    if (!ride || !userProfile) return;
    
    const myBooking = renderRide.seats.find(s => s.uid === userProfile.uid);
    if (myBooking) {
      setConfirmModal({ isOpen: true, seatNo: myBooking.seatNo, action: 'cancel' });
      return;
    }

    const inboundVehType = ride.inboundVehicleType ?? ride.vehicleType;
    const outboundVehType = ride.outboundVehicleType ?? ride.vehicleType;
    
    const inboundVeh = availableVehicles.find(v => v.id === (ride.inboundVehicleId ?? ride.vehicleId));
    const outboundVeh = availableVehicles.find(v => v.id === (ride.outboundVehicleId ?? ride.vehicleId));
    
    const inboundPassengerSeats = inboundVeh ? inboundVeh.passengerSeats : VEHICLE_CONFIGS[inboundVehType].passengerSeats;
    const outboundPassengerSeats = outboundVeh ? outboundVeh.passengerSeats : VEHICLE_CONFIGS[outboundVehType].passengerSeats;

    let maxPassengerSeats = 13;
    if (bookingDirection === 'inbound') {
      maxPassengerSeats = inboundPassengerSeats;
    } else if (bookingDirection === 'outbound') {
      maxPassengerSeats = outboundPassengerSeats;
    } else {
      maxPassengerSeats = Math.min(inboundPassengerSeats, outboundPassengerSeats);
    }
    
    const isSeatOccupied = (seatNo: number) => {
      return renderRide.seats.some(s => s.seatNo === seatNo && (
        s.direction === 'roundtrip' || 
        bookingDirection === 'roundtrip' || 
        s.direction === bookingDirection
      ));
    };

    let nextSeat = null;
    
    // Seat numbers start at 1
    for (let i = 1; i <= maxPassengerSeats; i++) {
      if (!isSeatOccupied(i)) {
        nextSeat = i;
        break;
      }
    }

    if (nextSeat === null) {
      setMessage({ text: lang === 'en' ? 'No seats available for this direction.' : 'ที่นั่งสำหรับเที่ยวรถนี้เต็มแล้ว', type: 'error' });
      return;
    }

    // Do NOT override bookingDirection/bookingLocation, use what they selected in the left panel
    setConfirmModal({ isOpen: true, seatNo: nextSeat, action: 'book' });
  };

  const confirmSeatAction = async () => {
    if (!ride || !userProfile || confirmModal.seatNo === null) return;
    
    const seatNo = confirmModal.seatNo;
    const action = confirmModal.action;
    
    setConfirmModal({ isOpen: false, seatNo: null, action: null });
    setBooking(true);
    setMessage(null);

    try {
      let newSeats: SeatBooking[];

      if (action === 'cancel') {
        newSeats = renderRide.seats.filter(s => s.uid !== userProfile.uid);
        setMessage({ text: t.msgCancel, type: 'success' });
      } else if (action === 'move') {
        newSeats = renderRide.seats
          .filter(s => s.uid !== userProfile.uid)
          .concat({
            seatNo,
            uid: userProfile.uid,
            userFullName: userProfile.fullName,
            userNickname: userProfile.nickname,
            userPhotoURL: userProfile.photoURL,
            bookedAt: Date.now(),
            direction: bookingDirection,
            location: bookingLocation,
          });
        setMessage({ text: t.msgMoved.replace('{seatNo}', seatNo.toString()), type: 'success' });
      } else {
        newSeats = [...renderRide.seats, {
          seatNo,
          uid: userProfile.uid,
          userFullName: userProfile.fullName,
          userNickname: userProfile.nickname,
          userPhotoURL: userProfile.photoURL,
          bookedAt: Date.now(),
          direction: bookingDirection,
          location: bookingLocation,
        }];
        setMessage({ text: t.msgBooked.replace('{seatNo}', seatNo.toString()), type: 'success' });
      }

      const inboundVehId = ride?.inboundVehicleId || defaultInboundVeh?.id || '';
      const inboundVehType = ride?.inboundVehicleType || defaultInboundVeh?.type || (selectedShift === 'morning' ? 'pickup' : 'van');
      const inboundTotalSeats = ride?.inboundTotalSeats || defaultInboundVeh?.totalSeats || VEHICLE_CONFIGS[inboundVehType].totalSeats;

      const outboundVehId = ride?.outboundVehicleId || defaultOutboundVeh?.id || '';
      const outboundVehType = ride?.outboundVehicleType || defaultOutboundVeh?.type || (selectedShift === 'morning' ? 'pickup' : 'van');
      const outboundTotalSeats = ride?.outboundTotalSeats || defaultOutboundVeh?.totalSeats || VEHICLE_CONFIGS[outboundVehType].totalSeats;

      const docId = ride?.id || `${selectedDate}_${selectedShift}`;

      const updatedRide: ShuttleRide = {
        ...(ride || {
          id: docId,
          shift: selectedShift,
          date: selectedDate,
          availableLocations: defaultLocationsForShift(selectedShift),
          isClosed: false,
          isForceOpened: false,
        }),
        inboundVehicleId: inboundVehId,
        inboundVehicleType: inboundVehType,
        inboundTotalSeats: inboundTotalSeats,
        outboundVehicleId: outboundVehId,
        outboundVehicleType: outboundVehType,
        outboundTotalSeats: outboundTotalSeats,
        
        vehicleId: inboundVehId,
        vehicleType: inboundVehType,
        totalSeats: inboundTotalSeats,
        
        seats: newSeats,
        updatedAt: Date.now(),
      } as ShuttleRide;

      await setDoc(doc(db, 'shuttleRides', docId), updatedRide);
      setRide(updatedRide);
    } catch {
      setMessage({ text: t.msgBookFail, type: 'error' });
    } finally {
      setBooking(false);
    }
  };

  const openRollCall = (leg: 'inbound' | 'outbound') => {
    if (!ride) return;
    setRollCallLeg(leg);
    const initialState = renderRide.seats.reduce((acc, seat) => {
      acc[seat.seatNo] = leg === 'inbound' ? !!seat.inboundCheckedIn : !!seat.outboundCheckedIn;
      return acc;
    }, {} as Record<number, boolean>);
    setLocalRollCallState(initialState);
    setIsRollCallModalOpen(true);
  };

  const confirmRollCall = async () => {
    if (!ride) return;
    setBooking(true);
    try {
      const updatedSeats = renderRide.seats.map(s => ({
        ...s,
        [rollCallLeg === 'inbound' ? 'inboundCheckedIn' : 'outboundCheckedIn']: localRollCallState[s.seatNo] || false
      }));
      
      const now = Date.now();
      const updateData: any = {
        seats: updatedSeats,
        updatedAt: now
      };
      if (rollCallLeg === 'inbound') {
        updateData.inboundRollCallCompletedAt = now;
      } else {
        updateData.outboundRollCallCompletedAt = now;
      }

      await updateDoc(doc(db, 'shuttleRides', ride!.id), updateData);
      
      setRide(prev => prev ? { ...prev, ...updateData } : prev);
      setIsRollCallModalOpen(false);
      setMessage({ text: lang === 'en' ? 'Roll-call confirmed successfully.' : 'บันทึกการเช็คชื่อเรียบร้อยแล้ว', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: lang === 'en' ? 'Failed to confirm roll-call.' : 'เกิดข้อผิดพลาดในการบันทึกการเช็คชื่อ', type: 'error' });
    } finally {
      setBooking(false);
    }
  };

  const handleShowProfile = async (uid: string) => {
    if (!ride) return;
    const seat = renderRide.seats.find(s => s.uid === uid);
    if (!seat) return;
    setSelectedSeatForProfile(seat);
    setSelectedSeatProfileData(null);
    setIsImageEnlarged(false);
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setSelectedSeatProfileData(userDoc.data() as UserProfile);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const myBooking = ride?.seats.find(s => s.uid === userProfile?.uid);
  // isDriver = true when driver is in management/schedule view (not booking mode)
  const isDriver = (userProfile?.role === 'driver' || userProfile?.role === 'admin' || isMasterAdmin) && !driverBookMode;
  const defaultInboundType = shuttleDefaults[selectedShift]?.inbound || (selectedShift === 'morning' ? 'pickup' : 'van');
  const defaultOutboundType = shuttleDefaults[selectedShift]?.outbound || (selectedShift === 'morning' ? 'pickup' : 'van');

  const defaultInboundVeh = availableVehicles.filter(v => v.type === defaultInboundType)[0] || availableVehicles[0] || null;
  const defaultOutboundVeh = availableVehicles.filter(v => v.type === defaultOutboundType)[0] || availableVehicles[0] || null;

  const assignedInboundVehicle = ride 
    ? (availableVehicles.find(v => v.id === (ride.inboundVehicleId ?? ride.vehicleId)) || defaultInboundVeh)
    : defaultInboundVeh;
  const assignedOutboundVehicle = ride 
    ? (availableVehicles.find(v => v.id === (ride.outboundVehicleId ?? ride.vehicleId)) || defaultOutboundVeh)
    : defaultOutboundVeh;
  const currentAssignedVehicle = viewDirection === 'inbound' ? assignedInboundVehicle : assignedOutboundVehicle;

  const inboundVehType = ride?.inboundVehicleType ?? ride?.vehicleType ?? assignedInboundVehicle?.type ?? defaultInboundType;
  const outboundVehType = ride?.outboundVehicleType ?? ride?.vehicleType ?? assignedOutboundVehicle?.type ?? defaultOutboundType;
  const currentVehType = viewDirection === 'inbound' ? inboundVehType : outboundVehType;

  const inboundCapacity = assignedInboundVehicle ? assignedInboundVehicle.totalSeats : VEHICLE_CONFIGS[inboundVehType].totalSeats;
  const outboundCapacity = assignedOutboundVehicle ? assignedOutboundVehicle.totalSeats : VEHICLE_CONFIGS[outboundVehType].totalSeats;
  const currentCapacity = viewDirection === 'inbound' ? inboundCapacity : outboundCapacity;

  return (
    <div className={styles.page}>
      <button
        onClick={() => router.back()}
        className={styles.backBtn}
        aria-label="Go back"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>{lang === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
      </button>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        {myBooking && (
          <div className={styles.myBookingBadge} style={{ alignItems: 'flex-start', padding: '8px 12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{t.seatBooked.replace('{seatNo}', myBooking.seatNo.toString())}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                {myBooking.direction === 'inbound' ? (lang === 'en' ? 'Inbound' : 'ขามา') : myBooking.direction === 'outbound' ? (lang === 'en' ? 'Outbound' : 'ขากลับ') : (lang === 'en' ? 'Round Trip' : 'ไป-กลับ')}
                {' • '}
                {myBooking.location === 'kathu' ? (lang === 'en' ? 'Kathu' : 'กะทู้') : (lang === 'en' ? 'Dormitory' : 'หอพัก')}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.selectors}>
        <div className="form-group" style={{ flex: 1, maxWidth: 220 }}>
          <label className="form-label" htmlFor="shuttle-date">{t.dateLabel}</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div className="form-input" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg)' }}>
              <span>{formatDateLong(selectedDate, lang)}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-2)' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <input
              id="shuttle-date"
              type="date"
              value={selectedDate}
              min={todayStr()}
              max={isMasterAdmin ? undefined : tomorrowStr()}
              onChange={e => setSelectedDate(e.target.value)}
              onClick={e => {
                try {
                  if ('showPicker' in HTMLInputElement.prototype) {
                    (e.target as HTMLInputElement).showPicker();
                  }
                } catch (err) {}
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        <div className="form-group" style={{ flex: 2, minWidth: 300 }}>
          <label className="form-label">{t.shiftLabel}</label>
          <div className={styles.shiftPicker} role="radiogroup" aria-label="Select shift">
          {shifts.map(shift => (
            <button
              key={shift.key}
              id={`shift-${shift.key}`}
              className={`${styles.shiftBtn} ${selectedShift === shift.key ? styles.shiftBtnActive : ''}`}
              onClick={() => setSelectedShift(shift.key)}
              role="radio"
              aria-checked={selectedShift === shift.key}
            >
              <span className={styles.shiftLabel}>{shift.label}</span>
              <span className={styles.shiftTime}>{shift.time}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {(userProfile?.role === 'admin' || isMasterAdmin) && (
        <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeInUp 0.3s ease both' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-1)' }}>
            ⚙️ {lang === 'en' ? 'Default Vehicle Settings per Shift' : 'ตั้งค่าเริ่มต้นประเภทรถแต่ละกะ'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {shifts.map(shift => (
              <div key={shift.key} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--color-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
                  {shift.label}
                </span>
                
                {/* Inbound Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--color-primary)' }}>
                    {lang === 'en' ? 'Inbound (To Work)' : 'เที่ยวขามา (ไปทำงาน)'}
                  </label>
                  <select
                    className="form-select"
                    value={shuttleDefaults[shift.key as ShiftType]?.inbound || 'van'}
                    onChange={async e => {
                      const newType = e.target.value as VehicleType;
                      const currentVal = shuttleDefaults[shift.key as ShiftType] || { inbound: 'van', outbound: 'van' };
                      const updated = {
                        ...shuttleDefaults,
                        [shift.key]: {
                          ...currentVal,
                          inbound: newType
                        }
                      };
                      setShuttleDefaults(updated);
                      try {
                        await setDoc(doc(db, 'settings', 'shuttle'), { defaults: updated }, { merge: true });
                        setMessage({ text: lang === 'en' ? 'Inbound default updated successfully!' : 'บันทึกรถขามาเรียบร้อยแล้ว', type: 'success' });
                      } catch (err: any) {
                        console.error(err);
                        setMessage({ text: lang === 'en' ? 'Failed to update.' : 'บันทึกไม่สำเร็จ', type: 'error' });
                      }
                    }}
                    style={{ fontSize: '0.85rem', padding: '4px 28px 4px 8px', height: '36px' }}
                  >
                    <option value="van">{lang === 'en' ? 'Van (13 seats)' : 'รถตู้ (Van - 13 ที่นั่ง)'}</option>
                    <option value="pickup">{lang === 'en' ? 'Pickup (13 seats)' : 'รถกระบะ (Pickup - 13 ที่นั่ง)'}</option>
                    <option value="carry">{lang === 'en' ? 'Suzuki Carry (1 seat)' : 'รถซูซูกิ แครี่ (Carry - 1 ที่นั่ง)'}</option>
                  </select>
                </div>

                {/* Outbound Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>
                    {lang === 'en' ? 'Outbound (To Home)' : 'เที่ยวขากลับ (กลับหอพัก)'}
                  </label>
                  <select
                    className="form-select"
                    value={shuttleDefaults[shift.key as ShiftType]?.outbound || 'van'}
                    onChange={async e => {
                      const newType = e.target.value as VehicleType;
                      const currentVal = shuttleDefaults[shift.key as ShiftType] || { inbound: 'van', outbound: 'van' };
                      const updated = {
                        ...shuttleDefaults,
                        [shift.key]: {
                          ...currentVal,
                          outbound: newType
                        }
                      };
                      setShuttleDefaults(updated);
                      try {
                        await setDoc(doc(db, 'settings', 'shuttle'), { defaults: updated }, { merge: true });
                        setMessage({ text: lang === 'en' ? 'Outbound default updated successfully!' : 'บันทึกรถขากลับเรียบร้อยแล้ว', type: 'success' });
                      } catch (err: any) {
                        console.error(err);
                        setMessage({ text: lang === 'en' ? 'Failed to update.' : 'บันทึกไม่สำเร็จ', type: 'error' });
                      }
                    }}
                    style={{ fontSize: '0.85rem', padding: '4px 28px 4px 8px', height: '36px' }}
                  >
                    <option value="van">{lang === 'en' ? 'Van (13 seats)' : 'รถตู้ (Van - 13 ที่นั่ง)'}</option>
                    <option value="pickup">{lang === 'en' ? 'Pickup (13 seats)' : 'รถกระบะ (Pickup - 13 ที่นั่ง)'}</option>
                    <option value="carry">{lang === 'en' ? 'Suzuki Carry (1 seat)' : 'รถซูซูกิ แครี่ (Carry - 1 ที่นั่ง)'}</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className={`${styles.message} ${message.type === 'success' ? styles.messageSuccess : styles.messageError}`} role="alert">
          {message.type === 'success'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
          {message.text}
        </div>
      )}

      {loadingRide ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" style={{ color: '#6C63FF' }} />
          <span>{t.loading}</span>
        </div>
      ) : ride?.isClosed ? (
        <div className={styles.noRideCard}>
          <div className={styles.noRideIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
          </div>
          <h2 className={styles.noRideTitle}>{lang === 'en' ? 'Booking is Closed' : 'ปิดรับจองสำหรับกะนี้'}</h2>
          
          {(userProfile?.role === 'admin' || isMasterAdmin) ? (
            <>
              <p className={styles.noRideBody}>{lang === 'en' ? 'You can re-open booking for this shift.' : 'คุณสามารถเปิดรับจองที่นั่งสำหรับกะนี้ได้'}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setBooking(true);
                    try {
                      await setDoc(doc(db, 'shuttleRides', ride!.id), { ...ride!, isClosed: false, isForceOpened: true, updatedAt: Date.now() }, { merge: true });
                      setRide(prev => prev ? { ...prev, isClosed: false, isForceOpened: true } : prev);
                    } catch (err: any) {
                      alert(err.message);
                    } finally {
                      setBooking(false);
                    }
                  }}
                  disabled={booking}
                >
                  {booking ? <span className="spinner" /> : (lang === 'en' ? 'Re-open Booking' : 'เปิดรับจองอีกครั้ง')}
                </button>
                {(userProfile?.role === "admin" || isMasterAdmin) && ride && (
                  <button
                    className="btn btn-outline"
                    onClick={async () => {
                      setBooking(true);
                      try {
                        await setDoc(doc(db, 'shuttleRides', ride!.id), { ...ride!, isClosed: false, isForceOpened: false, updatedAt: Date.now() }, { merge: true });
                        setRide(prev => prev ? { ...prev, isClosed: false, isForceOpened: false } : prev);
                      } catch (err: any) {
                        alert(err.message);
                      } finally {
                        setBooking(false);
                      }
                    }}
                    disabled={booking}
                  >
                    {booking ? <span className="spinner" /> : (lang === 'en' ? 'Resume Schedule' : 'กลับสู่เวลาปกติ')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className={styles.noRideBody}>{t.staffHint}</p>
          )}
        </div>
      ) : (
        <div className={styles.rideCard}>
          <div className={styles.rideCardLayout}>
            {/* Left side: Information and Actions */}
            <div className={styles.rideCardLeft}>
              {(userProfile?.role === 'admin' || isMasterAdmin) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
                  <button 
                    className="btn-ghost" 
                    style={{ color: 'var(--color-danger)', fontSize: '0.85rem', padding: '4px 12px' }}
                    onClick={async () => {
                      if (confirm(lang === 'en' ? 'Are you sure you want to close bookings?' : 'แน่ใจหรือไม่ว่าต้องการปิดรับจอง?')) {
                        setBooking(true);
                        try {
                          await setDoc(doc(db, 'shuttleRides', ride!.id), { ...ride!, isClosed: true, isForceOpened: false, updatedAt: Date.now() }, { merge: true });
                          setRide(prev => prev ? { ...prev, isClosed: true, isForceOpened: false } : prev);
                        } catch (err: any) {
                          alert(err.message);
                        } finally {
                          setBooking(false);
                        }
                      }
                    }}
                    disabled={booking}
                  >
                    {lang === 'en' ? 'Close Booking' : 'ปิดรับจอง'}
                  </button>

                  {renderRide.isForceOpened && (
                    <button
                      className="btn-ghost"
                      style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', padding: '4px 12px' }}
                      onClick={async () => {
                        setBooking(true);
                        try {
                          await setDoc(doc(db, 'shuttleRides', ride!.id), { ...ride!, isClosed: false, isForceOpened: false, updatedAt: Date.now() }, { merge: true });
                          setRide(prev => prev ? { ...prev, isClosed: false, isForceOpened: false } : prev);
                        } catch (err: any) {
                          alert(err.message);
                        } finally {
                          setBooking(false);
                        }
                      }}
                      disabled={booking}
                    >
                      {lang === 'en' ? 'Resume Schedule' : 'กลับสู่เวลาปกติ'}
                    </button>
                  )}
                </div>
              )}
              
              <div className={styles.rideInfo} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', borderBottom: 'none', paddingBottom: 0 }}>
                {/* Inbound Vehicle Info */}
                <div style={{ background: 'var(--color-bg-2)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }}></span>
                    {lang === 'en' ? 'Inbound (To Work)' : 'เที่ยวขามา (ไปทำงาน)'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div className={styles.rideInfoItem} style={{ margin: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                        <span>{assignedInboundVehicle ? `${assignedInboundVehicle.name} (${assignedInboundVehicle.licensePlate})` : VEHICLE_CONFIGS[inboundVehType].name}</span>
                      </div>
                      <div className={styles.rideInfoItem} style={{ margin: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        <span>{renderRide.seats.filter(s => s.direction === 'inbound' || s.direction === 'roundtrip').length} / {assignedInboundVehicle ? assignedInboundVehicle.passengerSeats : VEHICLE_CONFIGS[inboundVehType].passengerSeats} {t.seatsTaken}</span>
                      </div>
                    </div>

                    {isDriver && availableVehicles.length > 0 && (
                      <select
                        id="change-inbound-vehicle-select"
                        className="form-select"
                        value={renderRide.inboundVehicleId || renderRide.vehicleId || ''}
                        onChange={async e => {
                          const vId = e.target.value;
                          const veh = availableVehicles.find(v => v.id === vId);
                          if (!veh) return;
                          
                          // Check if new capacity is enough for current bookings
                          const currentBookings = renderRide.seats.filter(s => s.direction === 'inbound' || s.direction === 'roundtrip').length;
                          if (veh.passengerSeats < currentBookings) {
                            alert(lang === 'en' 
                              ? `Cannot change to this vehicle. It only has ${veh.passengerSeats} seats, but there are already ${currentBookings} bookings.`
                              : `ไม่สามารถเปลี่ยนเป็นรถคันนี้ได้เนื่องจากมีเพียง ${veh.passengerSeats} ที่นั่ง แต่ปัจจุบันมียอดจองแล้ว ${currentBookings} ที่นั่ง`
                            );
                            return;
                          }

                          await setDoc(doc(db, 'shuttleRides', ride!.id), {
                            ...ride,
                            inboundVehicleType: veh.type,
                            inboundVehicleId: veh.id,
                            inboundTotalSeats: veh.totalSeats,
                            updatedAt: Date.now(),
                          }, { merge: true });
                          setRide(prev => prev ? { 
                            ...prev, 
                            inboundVehicleType: veh.type, 
                            inboundVehicleId: veh.id, 
                            inboundTotalSeats: veh.totalSeats 
                          } : prev);
                        }}
                        style={{ width: 'auto', minWidth: 160, fontSize: '0.8rem', padding: '4px 28px 4px 8px', height: '32px' }}
                      >
                        {availableVehicles.map(v => {
                          const isBookingsHigher = v.passengerSeats < renderRide.seats.filter(s => s.direction === 'inbound' || s.direction === 'roundtrip').length;
                          return (
                            <option key={v.id} value={v.id} disabled={isBookingsHigher}>
                              {v.name} ({v.passengerSeats} seats){isBookingsHigher ? ` - ${lang === 'en' ? 'Not enough seats' : 'ที่นั่งไม่พอ'}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                </div>

                {/* Outbound Vehicle Info */}
                <div style={{ background: 'var(--color-bg-2)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }}></span>
                    {lang === 'en' ? 'Outbound (To Home)' : 'เที่ยวขากลับ (กลับหอพัก)'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div className={styles.rideInfoItem} style={{ margin: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                        <span>{assignedOutboundVehicle ? `${assignedOutboundVehicle.name} (${assignedOutboundVehicle.licensePlate})` : VEHICLE_CONFIGS[outboundVehType].name}</span>
                      </div>
                      <div className={styles.rideInfoItem} style={{ margin: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        <span>{renderRide.seats.filter(s => s.direction === 'outbound' || s.direction === 'roundtrip').length} / {assignedOutboundVehicle ? assignedOutboundVehicle.passengerSeats : VEHICLE_CONFIGS[outboundVehType].passengerSeats} {t.seatsTaken}</span>
                      </div>
                    </div>

                    {isDriver && availableVehicles.length > 0 && (
                      <select
                        id="change-outbound-vehicle-select"
                        className="form-select"
                        value={renderRide.outboundVehicleId || renderRide.vehicleId || ''}
                        onChange={async e => {
                          const vId = e.target.value;
                          const veh = availableVehicles.find(v => v.id === vId);
                          if (!veh) return;

                          // Check if new capacity is enough for current bookings
                          const currentBookings = renderRide.seats.filter(s => s.direction === 'outbound' || s.direction === 'roundtrip').length;
                          if (veh.passengerSeats < currentBookings) {
                            alert(lang === 'en' 
                              ? `Cannot change to this vehicle. It only has ${veh.passengerSeats} seats, but there are already ${currentBookings} bookings.`
                              : `ไม่สามารถเปลี่ยนเป็นรถคันนี้ได้เนื่องจากมีเพียง ${veh.passengerSeats} ที่นั่ง แต่ปัจจุบันมียอดจองแล้ว ${currentBookings} ที่นั่ง`
                            );
                            return;
                          }

                          await setDoc(doc(db, 'shuttleRides', ride!.id), {
                            ...ride,
                            outboundVehicleType: veh.type,
                            outboundVehicleId: veh.id,
                            outboundTotalSeats: veh.totalSeats,
                            updatedAt: Date.now(),
                          }, { merge: true });
                          setRide(prev => prev ? { 
                            ...prev, 
                            outboundVehicleType: veh.type, 
                            outboundVehicleId: veh.id, 
                            outboundTotalSeats: veh.totalSeats 
                          } : prev);
                        }}
                        style={{ width: 'auto', minWidth: 160, fontSize: '0.8rem', padding: '4px 28px 4px 8px', height: '32px' }}
                      >
                        {availableVehicles.map(v => {
                          const isBookingsHigher = v.passengerSeats < renderRide.seats.filter(s => s.direction === 'outbound' || s.direction === 'roundtrip').length;
                          return (
                            <option key={v.id} value={v.id} disabled={isBookingsHigher}>
                              {v.name} ({v.passengerSeats} seats){isBookingsHigher ? ` - ${lang === 'en' ? 'Not enough seats' : 'ที่นั่งไม่พอ'}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                </div>

                {/* Shift Time Info & Locations Toggle for Drivers/Admins */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }}>
                  <div className={styles.rideInfoItem}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{shifts.find(s => s.key === renderRide.shift)?.time}</span>
                  </div>

                  {isDriver && selectedShift !== 'day' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg-2)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-2)' }}>
                        {lang === 'en' ? 'Available Booking Locations:' : 'จุดบริการที่เปิดให้จอง:'}
                      </span>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="activeLocations"
                            checked={renderRide.availableLocations?.length === 1 && renderRide.availableLocations[0] === 'dormitory'} 
                            onChange={async () => {
                              const updated = { ...ride!, availableLocations: ['dormitory'] as ('dormitory' | 'kathu')[], updatedAt: Date.now() };
                              await setDoc(doc(db, 'shuttleRides', ride!.id), updated, { merge: true });
                              setRide(updated);
                            }} 
                          />
                          {lang === 'en' ? 'Dormitory Only' : 'เฉพาะหอพนักงาน'}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="activeLocations"
                            checked={!renderRide.availableLocations || renderRide.availableLocations.includes('kathu')} 
                            onChange={async () => {
                              const updated = { ...ride!, availableLocations: ['dormitory', 'kathu'] as ('dormitory' | 'kathu')[], updatedAt: Date.now() };
                              await setDoc(doc(db, 'shuttleRides', ride!.id), updated, { merge: true });
                              setRide(updated);
                            }} 
                          />
                          {lang === 'en' ? 'Dormitory + Kathu' : 'หอพนักงาน + กะทู้'}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.bookActionSection}>
                {isBookingWindowOpen && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span>{lang === 'en' ? 'Time remaining to book:' : 'เหลือเวลาจองอีก:'}</span>
                    <span style={{ fontSize: '1.4rem' }}>{formatTimeRemaining(timeRemainingMs)}</span>
                  </div>
                )}
                
                {isBeforeBooking && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#059669', padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span>{lang === 'en' ? 'Booking opens in:' : 'จะเปิดให้จองในอีก:'}</span>
                    <span style={{ fontSize: '1.4rem' }}>{formatTimeRemaining(timeUntilOpenMs)}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.8, marginTop: 4 }}>
                      ({lang === 'en' ? 'On ' : 'วันที่ '}
                      {new Date(openTime).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH')}
                      {lang === 'en' ? ' at 08:00' : ' เวลา 08:00 น.'})
                    </span>
                    {(userProfile?.role === 'admin' || isMasterAdmin) && ride && (
                      <button 
                        className="btn btn-primary" 
                        style={{ marginTop: 8, fontSize: '0.85rem' }}
                        onClick={async () => {
                          setBooking(true);
                          try {
                            await setDoc(doc(db, 'shuttleRides', ride!.id), { ...ride!, isClosed: false, isForceOpened: true, updatedAt: Date.now() }, { merge: true });
                            setRide(prev => prev ? { ...prev, isClosed: false, isForceOpened: true } : prev);
                          } finally {
                            setBooking(false);
                          }
                        }}
                        disabled={booking}
                      >
                        {booking ? <span className="spinner" /> : (lang === 'en' ? 'Force Open Now' : 'เปิดรับจองทันที')}
                      </button>
                    )}
                  </div>
                )}

                {isBookingPast && (
                  <div style={{ background: 'var(--color-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center', marginBottom: 16 }}>
                    <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                      {lang === 'en' ? 'Booking is closed.' : 'หมดเวลาการจองแล้ว'}
                    </p>
                  </div>
                )}

                {/* Driver Booking Mode toggle banner */}
                {userProfile?.role === 'driver' && !driverBookMode && (
                  <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', margin: 0 }}>
                      {lang === 'en' ? 'Want to reserve a seat for yourself?' : 'ต้องการจองที่นั่งสำหรับตัวเองด้วยไหม?'}
                    </p>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', minHeight: 'unset', whiteSpace: 'nowrap' }}
                      onClick={() => router.push('/shuttle?mode=book')}
                    >
                      {lang === 'en' ? 'Book a Seat' : 'จองที่นั่ง'}
                    </button>
                  </div>
                )}

                {(isDriver || isBookingPast || userProfile?.role === 'admin' || isMasterAdmin) ? (
                  <div style={{ background: 'var(--color-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    <p style={{ color: 'var(--color-text-1)', fontWeight: 600, marginBottom: 12 }}>
                      {lang === 'en' ? 'Passenger Summary' : 'สรุปยอดผู้โดยสาร'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: 'var(--color-text-2)', fontSize: '0.75rem', fontWeight: 600 }}>{lang === 'en' ? 'BY DIRECTION' : 'ตามเที่ยวรถ'}</span>
                        <span>{lang === 'en' ? 'Inbound:' : 'ขามา:'} <strong>{renderRide.seats.filter(s => s.direction === 'inbound' || s.direction === 'roundtrip').length}</strong></span>
                        <span>{lang === 'en' ? 'Outbound:' : 'ขากลับ:'} <strong>{renderRide.seats.filter(s => s.direction === 'outbound' || s.direction === 'roundtrip').length}</strong></span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: 'var(--color-text-2)', fontSize: '0.75rem', fontWeight: 600 }}>{lang === 'en' ? 'BY LOCATION' : 'ตามจุดรับส่ง'}</span>
                        <span>{lang === 'en' ? 'Dormitory:' : 'หอพัก:'} <strong>{renderRide.seats.filter(s => s.location === 'dormitory').length}</strong></span>
                        {selectedShift !== 'day' && (
                          <span>{lang === 'en' ? 'Kathu:' : 'กะทู้:'} <strong>{renderRide.seats.filter(s => s.location === 'kathu').length}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : myBooking ? (
                  isBookingWindowOpen ? (
                    <>
                      <p style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>
                        {lang === 'en' ? 'You have already booked a seat.' : 'คุณได้ทำการจองที่นั่งแล้ว'}
                      </p>
                      <p className={styles.hint} style={{ margin: '0 auto' }}>
                        {t.cancelHint.replace('{seatNo}', myBooking.seatNo.toString())}
                      </p>
                      <button 
                        className="btn btn-danger" 
                        onClick={handleAutoBook}
                        disabled={booking}
                      >
                        {lang === 'en' ? 'Cancel My Booking' : 'ยกเลิกการจอง'}
                      </button>
                    </>
                  ) : null
                ) : isBookingWindowOpen ? (
                  <>
                    <p style={{ color: 'var(--color-text-1)', fontWeight: 600, marginBottom: 8 }}>
                      {lang === 'en' ? 'Choose your trip' : 'เลือกการเดินทางของคุณ'}
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', background: 'var(--color-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                      <div>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-2)' }}>
                          {lang === 'en' ? 'Direction' : 'ทิศทางการเดินทาง'}
                        </label>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" name="mainDir" checked={bookingDirection === 'inbound'} onChange={() => { setBookingDirection('inbound'); setViewDirection('inbound'); }} /> 
                            {lang === 'en' ? 'Inbound' : 'ขามา'}
                          </label>
                          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" name="mainDir" checked={bookingDirection === 'outbound'} onChange={() => { setBookingDirection('outbound'); setViewDirection('outbound'); }} /> 
                            {lang === 'en' ? 'Outbound' : 'ขากลับ'}
                          </label>
                          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" name="mainDir" checked={bookingDirection === 'roundtrip'} onChange={() => setBookingDirection('roundtrip')} /> 
                            {lang === 'en' ? 'Round Trip' : 'ไป-กลับ'}
                          </label>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-2)' }}>
                          {lang === 'en' ? 'Location' : 'จุดขึ้น/ลงรถ'}
                        </label>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" name="mainLoc" checked={bookingLocation === 'dormitory'} onChange={() => setBookingLocation('dormitory')} /> 
                            {lang === 'en' ? 'Staff Dormitory' : 'หอพนักงาน'}
                          </label>
                          {selectedShift !== 'day' && (renderRide.availableLocations?.includes('kathu') || !renderRide.availableLocations) && (
                            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                              <input type="radio" name="mainLoc" checked={bookingLocation === 'kathu'} onChange={() => setBookingLocation('kathu')} /> 
                              {lang === 'en' ? 'Kathu Pick-up' : 'จุดรับส่งกะทู้'}
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary" 
                      onClick={handleAutoBook} 
                      disabled={booking || (() => {
                        const inboundBookedCount = renderRide.seats.filter(s => s.direction === 'inbound' || s.direction === 'roundtrip').length;
                        const outboundBookedCount = renderRide.seats.filter(s => s.direction === 'outbound' || s.direction === 'roundtrip').length;
                        const inboundPassengerSeats = assignedInboundVehicle ? assignedInboundVehicle.passengerSeats : VEHICLE_CONFIGS[inboundVehType].passengerSeats;
                        const outboundPassengerSeats = assignedOutboundVehicle ? assignedOutboundVehicle.passengerSeats : VEHICLE_CONFIGS[outboundVehType].passengerSeats;
                        
                        if (bookingDirection === 'inbound') {
                          return inboundBookedCount >= inboundPassengerSeats;
                        } else if (bookingDirection === 'outbound') {
                          return outboundBookedCount >= outboundPassengerSeats;
                        } else {
                          return inboundBookedCount >= inboundPassengerSeats || outboundBookedCount >= outboundPassengerSeats;
                        }
                      })()}
                      style={{ marginTop: 8 }}
                    >
                      {booking ? <span className="spinner" /> : lang === 'en' ? 'Book a Seat' : 'จองที่นั่ง'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Right side: Seat Map */}
            <div className={styles.rideCardRight} style={{ flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, background: 'var(--color-bg-2)', padding: 4, borderRadius: 999, border: '1px solid var(--color-border)' }}>
                <button 
                  className={viewDirection === 'inbound' ? 'btn-primary' : 'btn-ghost'} 
                  onClick={() => setViewDirection('inbound')}
                  style={{ borderRadius: 999, padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  {lang === 'en' ? 'Inbound (To Work)' : 'ขามา (ไปทำงาน)'}
                </button>
                <button 
                  className={viewDirection === 'outbound' ? 'btn-primary' : 'btn-ghost'} 
                  onClick={() => setViewDirection('outbound')}
                  style={{ borderRadius: 999, padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  {lang === 'en' ? 'Outbound (To Home)' : 'ขากลับ (กลับหอ)'}
                </button>
              </div>

              <SeatMap
                vehicleType={currentVehType}
                totalSeats={currentCapacity}
                seats={renderRide.seats.filter(s => s.direction === viewDirection || s.direction === 'roundtrip')}
                currentUserUid={userProfile?.uid ?? ''}
                currentUserPhotoURL={userProfile?.photoURL}
                onSeatClick={() => {}}
                onUserClick={handleShowProfile}
                disabled={true}
                isAdmin={userProfile?.role === 'admin' || isMasterAdmin}
              />
            </div>
          </div>

          {isDriver && renderRide.seats.length > 0 && (
            <div className={styles.passengerListSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className={styles.passengerListTitle} style={{ margin: 0 }}>
                  {lang === 'en' ? 'Passenger List & Roll-Call' : 'รายชื่อผู้โดยสาร & เช็คชื่อ'}
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Inbound Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button 
                    className={renderRide.inboundRollCallCompletedAt ? "btn btn-ghost" : "btn btn-primary"} 
                    onClick={() => openRollCall('inbound')}
                    style={{ flex: 1, border: renderRide.inboundRollCallCompletedAt ? '1px solid var(--color-border)' : undefined }}
                  >
                    {lang === 'en' ? `Inbound (${shifts.find(s => s.key === renderRide.shift)?.time.split(/\s*[-–]\s*/)[0] || ''})` : `รอบขามา (${shifts.find(s => s.key === renderRide.shift)?.time.split(/\s*[-–]\s*/)[0] || ''})`}
                  </button>
                  {renderRide.inboundRollCallCompletedAt && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, verticalAlign: 'text-bottom' }}><polyline points="20 6 9 17 4 12"/></svg>
                      {lang === 'en' ? 'Completed' : 'เรียบร้อย'}
                    </span>
                  )}
                </div>

                {/* Outbound Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button 
                    className={renderRide.outboundRollCallCompletedAt ? "btn btn-ghost" : "btn btn-primary"} 
                    onClick={() => openRollCall('outbound')}
                    style={{ flex: 1, border: renderRide.outboundRollCallCompletedAt ? '1px solid var(--color-border)' : undefined }}
                  >
                    {lang === 'en' ? `Outbound (${shifts.find(s => s.key === renderRide.shift)?.time.split(/\s*[-–]\s*/)[1] || ''})` : `รอบขากลับ (${shifts.find(s => s.key === renderRide.shift)?.time.split(/\s*[-–]\s*/)[1] || ''})`}
                  </button>
                  {renderRide.outboundRollCallCompletedAt && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, verticalAlign: 'text-bottom' }}><polyline points="20 6 9 17 4 12"/></svg>
                      {lang === 'en' ? 'Completed' : 'เรียบร้อย'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roll-Call Modal */}
      {isRollCallModalOpen && ride && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} role="dialog" aria-modal="true" style={{ maxWidth: 800, width: '90%' }}>
            <div className={styles.modalTitle}>
              {lang === 'en' ? (rollCallLeg === 'inbound' ? 'Inbound Roll-Call' : 'Outbound Roll-Call') : (rollCallLeg === 'inbound' ? 'เช็คชื่อรอบขามา' : 'เช็คชื่อรอบขากลับ')}
            </div>
            <div className={styles.modalBody} style={{ padding: '0' }}>
              <div className={styles.tableContainer} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className={styles.passengerTable}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-bg-2)' }}>
                    <tr>
                      <th style={{ width: 60, textAlign: 'center' }}>{lang === 'en' ? 'Seat' : 'ที่นั่ง'}</th>
                      <th>{lang === 'en' ? 'Name' : 'ชื่อเล่น'}</th>
                      <th style={{ width: 80, textAlign: 'center' }}>{lang === 'en' ? 'Check' : 'เช็ค'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderRide.seats.filter(s => s.direction === rollCallLeg || s.direction === 'roundtrip').slice().sort((a, b) => a.seatNo - b.seatNo).map((seat) => (
                      <tr key={seat.seatNo}>
                        <td className={styles.seatCell} style={{ textAlign: 'center' }}><strong>{seat.seatNo}</strong></td>
                        <td>
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            onClick={async () => {
                              setSelectedSeatForProfile(seat);
                              setSelectedSeatProfileData(null);
                              setIsImageEnlarged(false);
                              try {
                                const userDoc = await getDoc(doc(db, 'users', seat.uid));
                                if (userDoc.exists()) {
                                  setSelectedSeatProfileData(userDoc.data() as UserProfile);
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                          >
                            <div className={styles.miniAvatar}>
                              {seat.userPhotoURL ? (
                                <img src={seat.userPhotoURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                seat.userFullName?.[0] ?? '?'
                              )}
                            </div>
                            <span style={{ textDecoration: 'underline', color: 'var(--color-primary)', fontWeight: 500 }}>
                              {seat.userNickname || seat.userFullName.split(' ')[0]}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <label style={{ display: 'flex', justifyContent: 'center', margin: 0, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              style={{ width: 24, height: 24, margin: 0, cursor: 'pointer' }}
                              checked={!!localRollCallState[seat.seatNo]}
                              disabled={booking}
                              onChange={(e) => {
                                setLocalRollCallState(prev => ({
                                  ...prev,
                                  [seat.seatNo]: e.target.checked
                                }));
                              }}
                            />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.modalActions} style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setIsRollCallModalOpen(false)}
                disabled={booking}
              >
                {t.modalBtnCancel}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={confirmRollCall}
                disabled={booking}
              >
                {booking ? <span className="spinner" /> : (lang === 'en' ? 'Confirm Roll-Call' : 'ยืนยันการเช็คชื่อ')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {selectedSeatForProfile && (
        <>
          <div className={styles.modalOverlay} style={{ zIndex: 1000 }} onClick={() => setSelectedSeatForProfile(null)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '90%' }}>
              <div className={styles.modalTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                {lang === 'en' ? 'Passenger Details' : 'รายละเอียดผู้โดยสาร'}
              </div>
              <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                <div 
                  onClick={() => { if(selectedSeatForProfile.userPhotoURL) setIsImageEnlarged(true); }}
                  style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'var(--color-primary)', border: '2px solid var(--color-border)', cursor: selectedSeatForProfile.userPhotoURL ? 'pointer' : 'default' }}
                >
                  {selectedSeatForProfile.userPhotoURL ? (
                    <img 
                      src={selectedSeatForProfile.userPhotoURL} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  ) : (
                    selectedSeatForProfile.userFullName?.[0] ?? '?'
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem' }}>{selectedSeatForProfile.userFullName}</h3>
                  {selectedSeatForProfile.userNickname && (
                    <p style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '1rem', fontWeight: 500 }}>{selectedSeatForProfile.userNickname}</p>
                  )}
                </div>
                
                <div style={{ width: '100%', background: 'var(--color-bg-2)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>{lang === 'en' ? 'Department' : 'แผนก'}</span>
                    <strong style={{ fontSize: '1.1rem' }}>{selectedSeatProfileData ? selectedSeatProfileData.department : '...'}</strong>
                  </div>
                  {selectedSeatProfileData && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderTop: '1px solid var(--color-border)', width: '100%', paddingTop: 12 }}>
                        <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>{lang === 'en' ? 'Employee ID' : 'รหัสพนักงาน'}</span>
                        <strong style={{ fontSize: '1.1rem' }}>{selectedSeatProfileData.employeeId}</strong>
                      </div>
                      {selectedSeatProfileData.phone && userProfile?.role !== 'driver' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderTop: '1px solid var(--color-border)', width: '100%', paddingTop: 12 }}>
                          <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>{lang === 'en' ? 'Phone Number' : 'เบอร์โทรศัพท์'}</span>
                          <strong style={{ fontSize: '1.1rem' }}>{selectedSeatProfileData.phone}</strong>
                        </div>
                      )}
                    </>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderTop: '1px solid var(--color-border)', width: '100%', paddingTop: 12 }}>
                    <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>{lang === 'en' ? 'Booking Details' : 'รายละเอียดการจอง'}</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                      {selectedSeatForProfile.direction === 'inbound' ? (lang === 'en' ? 'Inbound Only' : 'ขามา') : selectedSeatForProfile.direction === 'outbound' ? (lang === 'en' ? 'Outbound Only' : 'ขากลับ') : (lang === 'en' ? 'Round Trip' : 'ไป-กลับ')}
                    </strong>
                  </div>
                </div>
              </div>
              <div className={styles.modalActions} style={{ padding: '16px 24px', borderTop: 'none', justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary" onClick={() => setSelectedSeatForProfile(null)} style={{ width: '100%' }}>
                  {lang === 'en' ? 'Close' : 'ปิด'}
                </button>
              </div>
            </div>
          </div>

          {isImageEnlarged && selectedSeatForProfile.userPhotoURL && (
            <div 
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
              onClick={() => setIsImageEnlarged(false)}
            >
              <img 
                src={selectedSeatForProfile.userPhotoURL} 
                alt="Enlarged profile" 
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none', borderRadius: 12 }} 
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.seatNo !== null && confirmModal.action && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalTitle}>
              {confirmModal.action === 'book' && t.modalTitleBook}
              {confirmModal.action === 'move' && t.modalTitleMove}
              {confirmModal.action === 'cancel' && t.modalTitleCancel}
            </div>
            <div className={styles.modalBody}>
              {confirmModal.action === 'book' && t.modalBodyBook.replace('{seatNo}', confirmModal.seatNo.toString())}
              {confirmModal.action === 'move' && t.modalBodyMove.replace('{seatNo}', confirmModal.seatNo.toString())}
              {confirmModal.action === 'cancel' && t.modalBodyCancel.replace('{seatNo}', confirmModal.seatNo.toString())}
            </div>
            <div className={styles.modalActions}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setConfirmModal({ isOpen: false, seatNo: null, action: null })}
                disabled={booking}
              >
                {t.modalBtnCancel}
              </button>
              <button 
                type="button" 
                className={confirmModal.action === 'cancel' ? 'btn btn-danger' : 'btn btn-primary'} 
                onClick={confirmSeatAction}
                disabled={booking}
              >
                {booking ? <span className="spinner" /> : t.modalBtnConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShuttlePage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, textAlign: 'center' }}><span className="spinner" /></div>}>
      <ShuttlePageInner />
    </Suspense>
  );
}
