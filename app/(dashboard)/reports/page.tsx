'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './reports.module.css';
import DateInput from '@/components/DateInput';
import type { GeneralRequest, ShuttleRide, RequestType, UserProfile, ShiftType } from '@/lib/types';
import { useLang } from '@/lib/use-lang';
import { useAuth } from '@/lib/auth-context';

interface DeptStat {
  department: string;
  shuttleCount: number;
  requestCount: number;
  total: number;
}

interface MonthData {
  month: string;
  shuttleBookings: number;
  totalRequests: number;
  approvedRequests: number;
  byDept: DeptStat[];
  byType: Partial<Record<RequestType, number>>;
}

interface PrintPayload {
  reportType: 'shuttle' | 'requests' | 'all';
  month: string;
  date: string;
  shift?: 'all' | ShiftType;
  direction?: 'all' | 'inbound' | 'outbound';
  shuttleRides: ShuttleRide[];
  requests: GeneralRequest[];
  userMap: Map<string, UserProfile>;
  vehicleMap: Map<string, any>;
  generatedAt: string;
}

function getMonths(n = 6) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-\ ${String(d.getMonth() + 1).padStart(2, '0')}`.replace(/\ /g, ''));
  }
  return months;
}

const LANG = {
  en: {
    title: 'Monthly Reports',
    subtitle: 'Usage summary by department and service type',
    month: 'Month',
    loading: 'Generating report…',
    shuttleBookings: 'Shuttle Bookings',
    generalRequests: 'General Requests',
    approvedRequests: 'Approved Requests',
    deptsActive: 'Departments Active',
    usageByDept: 'Usage by Department',
    requestTypes: 'Request Types',
    noData: 'No data for this month',
    noRequests: 'No requests this month',
    back: 'Back',
    exportTitle: 'Custom Export & Print Reports',
    exportSubtitle: 'Configure and download spreadsheet (CSV) or print-friendly PDF reports',
    btnShuttle: 'Download Shuttle CSV',
    btnRequests: 'Download Requests CSV',
    btnPrintPDF: 'Print / Save as PDF',
    loadingExport: 'Exporting…',
    loadingPDF: 'Preparing PDF…',
    
    // Custom filters
    lblReportType: 'Report Content',
    lblExportScope: 'Date Scope',
    lblExportDay: 'Select Specific Day',
    lblExportShift: 'Shuttle Shift',
    lblExportDir: 'Shuttle Direction',
    optAll: 'All',
    optMonth: 'Entire Month',
    optDay: 'Specific Day Only',
    optShuttle: 'Shuttle Bookings Only',
    optRequests: 'Logistics Requests Only',
    optBoth: 'All (Shuttle + Requests)',
    optInbound: 'Inbound Only',
    optOutbound: 'Outbound Only',
  },
  th: {
    title: 'รายงานประจำเดือน',
    subtitle: 'สรุปการใช้งานตามแผนกและประเภทการบริการ',
    month: 'เดือน',
    loading: 'กำลังสร้างรายงาน…',
    shuttleBookings: 'การจองรถรับส่ง',
    generalRequests: 'คำขอทั่วไป',
    approvedRequests: 'คำขอที่อนุมัติแล้ว',
    deptsActive: 'แผนกที่ใช้งาน',
    usageByDept: 'การใช้งานแยกตามแผนก',
    requestTypes: 'ประเภทคำขอ',
    noData: 'ไม่มีข้อมูลสำหรับเดือนนี้',
    noRequests: 'ไม่มีคำขอสำหรับเดือนนี้',
    back: 'ย้อนกลับ',
    exportTitle: 'ส่งออกข้อมูล & พิมพ์รายงาน',
    exportSubtitle: 'กำหนดช่วงข้อมูลเพื่อดาวน์โหลดไฟล์ CSV หรือพิมพ์รายงาน PDF',
    btnShuttle: 'ดาวน์โหลด Shuttle CSV',
    btnRequests: 'ดาวน์โหลด Requests CSV',
    btnPrintPDF: 'พิมพ์รายงาน / บันทึก PDF',
    loadingExport: 'กำลังส่งออก…',
    loadingPDF: 'กำลังเตรียม PDF…',
    
    // Custom filters
    lblReportType: 'เนื้อหารายงาน',
    lblExportScope: 'ช่วงเวลา',
    lblExportDay: 'เลือกวันที่ระบุ',
    lblExportShift: 'รอบเวลา (กะ)',
    lblExportDir: 'เที่ยวเดินรถ',
    optAll: 'ทั้งหมด',
    optMonth: 'ทั้งเดือน',
    optDay: 'เฉพาะวันที่กำหนด',
    optShuttle: 'เฉพาะข้อมูลรถรับส่ง',
    optRequests: 'เฉพาะข้อมูลการขอรถ / ของาน',
    optBoth: 'ทั้งหมด (รถรับส่ง + คำขอทั่วไป)',
    optInbound: 'ขามาอย่างเดียว',
    optOutbound: 'ขากลับอย่างเดียว',
  }
} as const;

export default function ReportsPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { userProfile, isAdmin, isDriver, isHR } = useAuth();
  const t = LANG[lang];
  
  // Protect route - only admin, driver, hr
  useEffect(() => {
    if (userProfile && !isAdmin && !isDriver && !isHR) {
      router.replace('/home');
    }
  }, [userProfile, isAdmin, isDriver, isHR, router]);

  const [selectedMonth, setSelectedMonth] = useState(getMonths(6)[0]);
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  
  // Custom export state
  const [exportType, setExportType] = useState<'shuttle' | 'requests' | 'all'>('all');
  const [exportDate, setExportDate] = useState('');
  const [exportShift, setExportShift] = useState<'all' | ShiftType>('all');
  const [exportDirection, setExportDirection] = useState<'all' | 'inbound' | 'outbound'>('all');

  // Print payload state
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);

  const months = getMonths(6);

  useEffect(() => {
    if (selectedMonth) {
      // We no longer set date range based on selected month because we pick a specific date
      const d = new Date();
      setExportDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }, [selectedMonth]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsSnap, ridesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'shuttleRides')),
        getDocs(collection(db, 'users')),
      ]);

      const allRequests = requestsSnap.docs.map(d => d.data() as GeneralRequest);
      const allRides = ridesSnap.docs.map(d => d.data() as ShuttleRide);

      const monthStr = selectedMonth; // YYYY-MM
      const monthRequests = allRequests.filter(r => r.requestedDate?.startsWith(monthStr));
      const monthRides = allRides.filter(r => r.date?.startsWith(monthStr));

      const deptMap = new Map<string, DeptStat>();

      monthRequests.forEach(r => {
        const d = r.requesterDepartment || 'Unknown';
        if (!deptMap.has(d)) deptMap.set(d, { department: d, shuttleCount: 0, requestCount: 0, total: 0 });
        const s = deptMap.get(d)!;
        s.requestCount++;
        s.total++;
      });

      const userDeptMap = new Map<string, string>();
      usersSnap.docs.forEach(d => {
        const u = d.data();
        userDeptMap.set(u.uid, u.department);
      });

      monthRides.forEach(ride => {
        (ride.seats ?? []).forEach((seat: any) => {
          const dept = userDeptMap.get(seat.uid) || 'Unknown';
          if (!deptMap.has(dept)) deptMap.set(dept, { department: dept, shuttleCount: 0, requestCount: 0, total: 0 });
          const s = deptMap.get(dept)!;
          s.shuttleCount++;
          s.total++;
        });
      });

      const byType: Partial<Record<RequestType, number>> = {};
      monthRequests.forEach(r => {
        byType[r.type] = (byType[r.type] ?? 0) + 1;
      });

      const totalShuttleBookings = monthRides.reduce((acc, r) => acc + (r.seats?.length ?? 0), 0);

      setData({
        month: monthStr,
        shuttleBookings: totalShuttleBookings,
        totalRequests: monthRequests.length,
        approvedRequests: monthRequests.filter(r => r.status === 'approved').length,
        byDept: Array.from(deptMap.values()).sort((a, b) => b.total - a.total),
        byType,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtering helper
  const filterDataForExport = useCallback((allRides: ShuttleRide[], allRequests: GeneralRequest[]) => {
    let filteredRides = allRides;
    if (exportDate) {
      filteredRides = filteredRides.filter(r => r.date === exportDate);
    }

    if (exportShift !== 'all') {
      filteredRides = filteredRides.filter(r => r.shift === exportShift);
    }

    if (exportDirection !== 'all') {
      filteredRides = filteredRides.map(ride => ({
        ...ride,
        seats: (ride.seats || []).filter(seat => {
          if (exportDirection === 'inbound') {
            return seat.direction === 'inbound' || seat.direction === 'roundtrip';
          } else {
            return seat.direction === 'outbound' || seat.direction === 'roundtrip';
          }
        })
      }));
    }

    let filteredRequests = allRequests;
    if (exportDate) {
      filteredRequests = filteredRequests.filter(r => r.requestedDate === exportDate);
    }

    return { filteredRides, filteredRequests };
  }, [exportDate, exportShift, exportDirection]);

  const downloadCSV = (rows: string[][], filename: string) => {
    const csvContent = "\uFEFF" + rows.map(e => e.map(val => {
      const cleanVal = (val || '').replace(/"/g, '""');
      return `"${cleanVal}"`;
    }).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadShuttleReport = async () => {
    setLoadingExport(true);
    try {
      const [ridesSnap, usersSnap, vehiclesSnap] = await Promise.all([
        getDocs(collection(db, 'shuttleRides')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'vehicles')),
      ]);

      const allRides = ridesSnap.docs.map(d => d.data() as ShuttleRide);
      const allUsers = usersSnap.docs.map(d => d.data() as UserProfile);
      const allVehicles = vehiclesSnap.docs.map(d => d.data());

      const userMap = new Map(allUsers.map(u => [u.uid, u]));
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

      const { filteredRides } = filterDataForExport(allRides, []);
      filteredRides.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.shift.localeCompare(b.shift);
      });

      const headers = [
        lang === 'en' ? 'Date' : 'วันที่',
        lang === 'en' ? 'Shift' : 'กะ',
        lang === 'en' ? 'Seat No' : 'หมายเลขที่นั่ง',
        lang === 'en' ? 'Employee ID' : 'รหัสพนักงาน',
        lang === 'en' ? 'Passenger Name' : 'ชื่อ-นามสกุล',
        lang === 'en' ? 'Nickname' : 'ชื่อเล่น',
        lang === 'en' ? 'Department' : 'แผนก',
        lang === 'en' ? 'Contact Phone' : 'เบอร์โทรศัพท์',
        lang === 'en' ? 'Direction' : 'เที่ยวรถ',
        lang === 'en' ? 'Location' : 'จุดรับส่ง',
        lang === 'en' ? 'Inbound Vehicle' : 'รถขามา',
        lang === 'en' ? 'Outbound Vehicle' : 'รถขากลับ',
        lang === 'en' ? 'Inbound Checked In' : 'เช็คชื่อขามา',
        lang === 'en' ? 'Outbound Checked In' : 'เช็คชื่อขากลับ',
        lang === 'en' ? 'Booked At' : 'เวลาที่จอง',
      ];

      const rows = [headers];

      filteredRides.forEach(ride => {
        const inboundVeh = vehicleMap.get(ride.inboundVehicleId || ride.vehicleId);
        const outboundVeh = vehicleMap.get(ride.outboundVehicleId || ride.vehicleId);
        const inboundVehName = inboundVeh ? `${inboundVeh.name} (${inboundVeh.licensePlate})` : '';
        const outboundVehName = outboundVeh ? `${outboundVeh.name} (${outboundVeh.licensePlate})` : '';

        const seats = ride.seats || [];
        if (seats.length === 0) {
          rows.push([
            ride.date,
            ride.shift === 'morning' ? 'Morning' : ride.shift === 'day' ? 'Day' : 'Afternoon',
            '-',
            '-',
            lang === 'en' ? '(No Passengers)' : '(ไม่มีผู้โดยสาร)',
            '-',
            '-',
            '-',
            '-',
            '-',
            inboundVehName,
            outboundVehName,
            '-',
            '-',
            '-',
          ]);
        } else {
          seats.forEach((seat: any) => {
            const user = userMap.get(seat.uid);
            rows.push([
              ride.date,
              ride.shift === 'morning' ? 'Morning' : ride.shift === 'day' ? 'Day' : 'Afternoon',
              seat.seatNo.toString(),
              user?.employeeId || '-',
              user?.fullName || seat.userFullName || '-',
              user?.nickname || seat.userNickname || '-',
              user?.department || '-',
              user?.phone || '-',
              seat.direction === 'inbound' ? (lang === 'en' ? 'Inbound' : 'ขามา') : seat.direction === 'outbound' ? (lang === 'en' ? 'Outbound' : 'ขากลับ') : (lang === 'en' ? 'Round Trip' : 'ไป-กลับ'),
              seat.location === 'dormitory' ? (lang === 'en' ? 'Staff Dormitory' : 'หอพนักงาน') : (lang === 'en' ? 'Kathu' : 'กะทู้'),
              inboundVehName,
              outboundVehName,
              seat.inboundCheckedIn ? (lang === 'en' ? 'Yes' : 'เช็คแล้ว') : (lang === 'en' ? 'No' : 'ยังไม่เช็ค'),
              seat.outboundCheckedIn ? (lang === 'en' ? 'Yes' : 'เช็คแล้ว') : (lang === 'en' ? 'No' : 'ยังไม่เช็ค'),
              seat.bookedAt ? new Date(seat.bookedAt).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH') : '-',
            ]);
          });
        }
      });

      const filename = `Shuttle_Report_${exportDate}.csv`;
      downloadCSV(rows, filename);
    } catch (err) {
      console.error(err);
      alert('Failed to generate shuttle report');
    } finally {
      setLoadingExport(false);
    }
  };

  const downloadRequestsReport = async () => {
    setLoadingExport(true);
    try {
      const requestsSnap = await getDocs(collection(db, 'requests'));
      const allRequests = requestsSnap.docs.map(d => d.data() as GeneralRequest);

      const { filteredRequests } = filterDataForExport([], allRequests);
      filteredRequests.sort((a, b) => {
        if (a.requestedDate !== b.requestedDate) return a.requestedDate.localeCompare(b.requestedDate);
        return (a.requestedTime || '').localeCompare(b.requestedTime || '');
      });

      const headers = [
        lang === 'en' ? 'Request ID' : 'รหัสคำขอ',
        lang === 'en' ? 'Created At' : 'วันที่ส่งคำขอ',
        lang === 'en' ? 'Type' : 'ประเภท',
        lang === 'en' ? 'Title' : 'หัวข้อ',
        lang === 'en' ? 'Description' : 'รายละเอียด',
        lang === 'en' ? 'Status' : 'สถานะ',
        lang === 'en' ? 'Requester Name' : 'ผู้ส่งคำขอ',
        lang === 'en' ? 'Requester Department' : 'แผนกผู้ส่ง',
        lang === 'en' ? 'Requested Date' : 'วันที่ใช้งาน',
        lang === 'en' ? 'Requested Time' : 'เวลาที่ใช้งาน',
        lang === 'en' ? 'Destination' : 'จุดรับส่งหลัก',
        lang === 'en' ? 'Stops Detail' : 'รายละเอียดจุดจอดทั้งหมด',
        lang === 'en' ? 'Passenger Count' : 'จำนวนผู้โดยสาร',
        lang === 'en' ? 'Passenger Names' : 'รายชื่อผู้โดยสาร',
        lang === 'en' ? 'Passenger Contacts' : 'เบอร์ติดต่อผู้โดยสาร',
        lang === 'en' ? 'Completed At' : 'เสร็จสิ้นเมื่อ',
        lang === 'en' ? 'Completion Note' : 'บันทึกหลังเสร็จงาน',
      ];

      const rows = [headers];

      filteredRequests.forEach(req => {
        let stopsText = '';
        if (req.destinations && req.destinations.length > 0) {
          stopsText = req.destinations.map((d, i) => {
            let info = `Stop ${i+1}: ${d.title || d.address}`;
            if (d.description) info += ` (${d.description})`;
            if (d.hasPassengers) info += ` [Passengers: ${d.passengerCount || 0}]`;
            return info;
          }).join(' | ');
        } else {
          stopsText = req.destination || '';
        }

        let passNames: string[] = [];
        let passContacts: string[] = [];
        let totalPassengers = 0;

        if (req.destinations) {
          req.destinations.forEach(d => {
            if (d.hasPassengers) {
              totalPassengers += d.passengerCount || 0;
              if (d.passengerName) passNames.push(d.passengerName);
              if (d.passengerContact) passContacts.push(d.passengerContact);
            }
          });
        }

        rows.push([
          req.id,
          req.createdAt ? new Date(req.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH') : '-',
          req.type === 'document' ? (lang === 'en' ? 'Document' : 'เอกสาร') : req.type === 'parcel' ? (lang === 'en' ? 'Parcel' : 'พัสดุ') : req.type === 'errand' ? (lang === 'en' ? 'Errand' : 'ธุระทั่วไป') : (lang === 'en' ? 'Other' : 'อื่นๆ'),
          req.title || '-',
          req.description || '-',
          req.status,
          req.requesterName || '-',
          req.requesterDepartment || '-',
          req.requestedDate || '-',
          req.requestedTime || '-',
          req.destination || '-',
          stopsText,
          totalPassengers.toString(),
          passNames.join(', ') || '-',
          passContacts.join(', ') || '-',
          req.completedAt ? new Date(req.completedAt).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH') : '-',
          req.completionNote || '-',
        ]);
      });

      const filename = `Logistics_Requests_${exportDate}.csv`;
      downloadCSV(rows, filename);
    } catch (err) {
      console.error(err);
      alert('Failed to generate logistics requests report');
    } finally {
      setLoadingExport(false);
    }
  };

  const downloadPDFReport = async () => {
    setLoadingPDF(true);
    try {
      const [ridesSnap, usersSnap, vehiclesSnap, requestsSnap] = await Promise.all([
        getDocs(collection(db, 'shuttleRides')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'vehicles')),
        getDocs(collection(db, 'requests')),
      ]);

      const allRides = ridesSnap.docs.map(d => d.data() as ShuttleRide);
      const allUsers = usersSnap.docs.map(d => d.data() as UserProfile);
      const allVehicles = vehiclesSnap.docs.map(d => d.data());
      const allRequests = requestsSnap.docs.map(d => d.data() as GeneralRequest);

      const userMap = new Map(allUsers.map(u => [u.uid, u]));
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

      const { filteredRides, filteredRequests } = filterDataForExport(allRides, allRequests);

      filteredRides.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.shift.localeCompare(b.shift);
      });
      filteredRequests.sort((a, b) => {
        if (a.requestedDate !== b.requestedDate) return a.requestedDate.localeCompare(b.requestedDate);
        return (a.requestedTime || '').localeCompare(b.requestedTime || '');
      });

      const payload: PrintPayload = {
        reportType: exportType,
        month: selectedMonth,
        date: exportDate,
        shift: exportShift,
        direction: exportDirection,
        shuttleRides: filteredRides,
        requests: filteredRequests,
        userMap,
        vehicleMap,
        generatedAt: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'th-TH'),
      };

      setPrintPayload(payload);
      
      // Allow DOM to render and trigger print dialog
      setTimeout(() => {
        window.print();
        setLoadingPDF(false);
      }, 500);

    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF');
      setLoadingPDF(false);
    }
  };

  const TYPE_LABELS: Record<RequestType, string> = {
    document: lang === 'en' ? '📄 Document' : '📄 เอกสาร',
    parcel: lang === 'en' ? '📦 Parcel' : '📦 พัสดุ',
    errand: lang === 'en' ? '🏃 Errand' : '🏃 ธุระทั่วไป',
    other: lang === 'en' ? '🔧 Other' : '🔧 อื่นๆ',
  };

  const maxTotal = data ? Math.max(...data.byDept.map(d => d.total), 1) : 1;

  return (
    <div className={styles.page}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ alignSelf: 'flex-start', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }} aria-label="Go back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>{t.back}</span>
      </button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="report-month">{t.month}</label>
          <select
            id="report-month"
            className="form-select"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ minWidth: 160 }}
          >
            {months.map(m => (
              <option key={m} value={m}>{formatMonth(m, lang)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Export & Print Panel */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.4s ease both' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>{t.exportTitle}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', marginTop: '4px' }}>{t.exportSubtitle}</p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: 'var(--color-bg-2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          {/* Report Type */}
          <div className="form-group">
            <label className="form-label">{t.lblReportType}</label>
            <select className="form-select" value={exportType} onChange={e => setExportType(e.target.value as any)}>
              <option value="all">{t.optBoth}</option>
              <option value="shuttle">{t.optShuttle}</option>
              <option value="requests">{t.optRequests}</option>
            </select>
          </div>

          {/* Select Date */}
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Select Date' : 'เลือกวันที่'}</label>
            <DateInput
              value={exportDate}
              onChange={e => setExportDate(e.target.value)}
            />
          </div>

          {/* Shuttle Shift */}
          {(exportType === 'shuttle' || exportType === 'all') && (
            <div className="form-group">
              <label className="form-label">{t.lblExportShift}</label>
              <select className="form-select" value={exportShift} onChange={e => setExportShift(e.target.value as any)}>
                <option value="all">{t.optAll}</option>
                <option value="morning">Morning (เช้า)</option>
                <option value="day">Day (กลางวัน)</option>
                <option value="afternoon">Afternoon (บ่าย)</option>
              </select>
            </div>
          )}

          {/* Shuttle Direction */}
          {(exportType === 'shuttle' || exportType === 'all') && (
            <div className="form-group">
              <label className="form-label">{t.lblExportDir}</label>
              <select className="form-select" value={exportDirection} onChange={e => setExportDirection(e.target.value as any)}>
                <option value="all">{t.optAll}</option>
                <option value="inbound">{t.optInbound}</option>
                <option value="outbound">{t.optOutbound}</option>
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
          {(exportType === 'shuttle' || exportType === 'all') && (
            <button 
              id="download-shuttle-report-btn"
              onClick={downloadShuttleReport} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              disabled={loadingExport || loadingPDF || loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {loadingExport ? t.loadingExport : t.btnShuttle}
            </button>
          )}
          {(exportType === 'requests' || exportType === 'all') && (
            <button 
              id="download-requests-report-btn"
              onClick={downloadRequestsReport} 
              className="btn btn-outline" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              disabled={loadingExport || loadingPDF || loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {loadingExport ? t.loadingExport : t.btnRequests}
            </button>
          )}
          <button 
            id="print-pdf-report-btn"
            onClick={downloadPDFReport} 
            className="btn-gradient" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', color: '#fff', fontWeight: 600 }}
            disabled={loadingExport || loadingPDF || loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            {loadingPDF ? t.loadingPDF : t.btnPrintPDF}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}><div className="spinner" style={{ color: '#6C63FF' }} /><span>{t.loading}</span></div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ color: '#4ECDC4', background: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.2)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                  <line x1="12" y1="2" x2="12" y2="9.5" />
                  <line x1="12" y1="12" x2="4" y2="17" />
                  <line x1="12" y1="12" x2="20" y2="17" />
                </svg>
              </div>
              <div className={styles.summaryVal} style={{ color: '#4ECDC4' }}>{data.shuttleBookings}</div>
              <div className={styles.summaryLabel}>{t.shuttleBookings}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ color: '#6C63FF', background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
              </div>
              <div className={styles.summaryVal} style={{ color: '#6C63FF' }}>{data.totalRequests}</div>
              <div className={styles.summaryLabel}>{t.generalRequests}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ color: '#22C55E', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className={styles.summaryVal} style={{ color: '#22C55E' }}>{data.approvedRequests}</div>
              <div className={styles.summaryLabel}>{t.approvedRequests}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <div className={styles.summaryVal} style={{ color: '#F59E0B' }}>{data.byDept.length}</div>
              <div className={styles.summaryLabel}>{t.deptsActive}</div>
            </div>
          </div>

          <div className={styles.twoCol}>
            {/* Department breakdown */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>{t.usageByDept}</h2>
              {data.byDept.length === 0 ? (
                <p className={styles.noData}>{t.noData}</p>
              ) : (
                <div className={styles.deptList}>
                  {data.byDept.map((dept, i) => (
                    <div key={dept.department} className={styles.deptRow} style={{ animationDelay: `${i * 40}ms` }}>
                      <div className={styles.deptName}>{dept.department}</div>
                      <div className={styles.deptBarWrap}>
                        <div className={styles.deptBar} style={{ width: `${(dept.total / maxTotal) * 100}%` }} />
                      </div>
                      <div className={styles.deptNums}>
                        <span title="Shuttle bookings" style={{ color: '#4ECDC4' }}>🚌 {dept.shuttleCount}</span>
                        <span title="General requests" style={{ color: '#6C63FF' }}>📋 {dept.requestCount}</span>
                        <span className={styles.deptTotal}>{dept.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Request type breakdown */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>{t.requestTypes}</h2>
              {Object.keys(data.byType).length === 0 ? (
                <p className={styles.noData}>{t.noRequests}</p>
              ) : (
                <div className={styles.typeList}>
                  {(Object.entries(data.byType) as [RequestType, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className={styles.typeRow}>
                        <span className={styles.typeLabel}>{TYPE_LABELS[type]}</span>
                        <div className={styles.typeBarWrap}>
                          <div
                            className={styles.typeBar}
                            style={{ width: `${(count / data.totalRequests) * 100}%` }}
                          />
                        </div>
                        <span className={styles.typeCount}>{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* ── PRINT AREA (Hidden on screen, styled for beautiful PDF printing) ── */}
      {printPayload && (
        <div className={styles.printArea}>
          <div className={styles.printHeader}>
            <div>
              <h1 className={styles.printTitle}>
                {lang === 'en' ? 'CONCIERGE RIDE - TRANSPORT REPORT' : 'คอนเซียร์จ ไรด์ - รายงานระบบเดินรถ'}
              </h1>
              <p className={styles.printSubtitle}>
                {lang === 'en' ? 'Report Scope: ' : 'ขอบเขตรายงาน: '}
                <strong>
                  {printPayload.date}
                </strong>
                {printPayload.shift && printPayload.shift !== 'all' && ` | กะ: ${printPayload.shift === 'morning' ? 'เช้า' : printPayload.shift === 'day' ? 'กลางวัน' : 'บ่าย'}`}
                {printPayload.direction && printPayload.direction !== 'all' && ` | เที่ยวรถ: ${printPayload.direction === 'inbound' ? 'ขามา' : 'ขากลับ'}`}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#666' }}>
              <div>{lang === 'en' ? 'Generated At:' : 'ดึงข้อมูลเมื่อ:'} {printPayload.generatedAt}</div>
              <div>{lang === 'en' ? 'Prepared by:' : 'จัดทำโดย:'} {userProfile?.fullName} ({userProfile?.role})</div>
            </div>
          </div>

          {/* Quick summary cards for PDF */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', borderBottom: '2px solid #333', paddingBottom: '16px' }}>
            {(printPayload.reportType === 'shuttle' || printPayload.reportType === 'all') && (
              <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>
                  {lang === 'en' ? 'Shuttle Summary' : 'สรุปข้อมูลรถรับส่งพนักงาน'}
                </strong>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {printPayload.shuttleRides.reduce((acc, r) => acc + (r.seats?.length ?? 0), 0)}
                </span> {lang === 'en' ? 'Seats Booked' : 'ที่นั่งที่จอง'}
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                  {printPayload.shuttleRides.length} {lang === 'en' ? 'Active shifts exported' : 'รอบการเดินรถ'}
                </div>
              </div>
            )}
            {(printPayload.reportType === 'requests' || printPayload.reportType === 'all') && (
              <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>
                  {lang === 'en' ? 'Logistics Summary' : 'สรุปข้อมูลคำขอใช้บริการ'}
                </strong>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printPayload.requests.length}</span> {lang === 'en' ? 'Requests Total' : 'รายการคำขอทั้งหมด'}
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                  {printPayload.requests.filter(r => r.status === 'completed').length} {lang === 'en' ? 'Completed jobs' : 'งานที่เสร็จสิ้นเรียบร้อย'}
                </div>
              </div>
            )}
          </div>

          {/* Shuttle passenger list report */}
          {(printPayload.reportType === 'shuttle' || printPayload.reportType === 'all') && (
            <div style={{ marginBottom: '24px' }} className="print-section">
              <h2 style={{ fontSize: '1.1rem', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '12px' }}>
                {lang === 'en' ? 'Employee Shuttle Booking Details' : 'รายละเอียดการจองรถรับส่งพนักงาน'}
              </h2>
              {printPayload.shuttleRides.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>{lang === 'en' ? 'No shuttle data matching criteria' : 'ไม่มีข้อมูลการเดินรถตรงตามที่เลือก'}</p>
              ) : (
                printPayload.shuttleRides.map(ride => {
                  const inboundVeh = printPayload.vehicleMap.get(ride.inboundVehicleId || ride.vehicleId);
                  const outboundVeh = printPayload.vehicleMap.get(ride.outboundVehicleId || ride.vehicleId);
                  const inboundVehName = inboundVeh ? `${inboundVeh.name} (${inboundVeh.licensePlate})` : '';
                  const outboundVehName = outboundVeh ? `${outboundVeh.name} (${outboundVeh.licensePlate})` : '';
                  
                  return (
                    <div key={ride.id} style={{ marginBottom: '18px', pageBreakInside: 'avoid' }}>
                      <div style={{ background: '#f5f5f5', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {lang === 'en' ? 'Date:' : 'วันที่:'} {ride.date} | {lang === 'en' ? 'Shift:' : 'กะ:'} {ride.shift === 'morning' ? 'Morning (เช้า)' : ride.shift === 'day' ? 'Day (กลางวัน)' : 'Afternoon (บ่าย)'}
                        </span>
                        <span>
                          {lang === 'en' ? 'Inbound Veh:' : 'รถขามา:'} {inboundVehName || '-'} | {lang === 'en' ? 'Outbound Veh:' : 'รถขากลับ:'} {outboundVehName || '-'}
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '6px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid #333', textAlign: 'left', fontWeight: 'bold' }}>
                            <th style={{ padding: '4px', width: '50px' }}>{lang === 'en' ? 'Seat' : 'ที่นั่ง'}</th>
                            <th style={{ padding: '4px', width: '90px' }}>{lang === 'en' ? 'Emp ID' : 'รหัสพนักงาน'}</th>
                            <th style={{ padding: '4px' }}>{lang === 'en' ? 'Name' : 'ชื่อ-นามสกุล'}</th>
                            <th style={{ padding: '4px', width: '70px' }}>{lang === 'en' ? 'Nickname' : 'ชื่อเล่น'}</th>
                            <th style={{ padding: '4px' }}>{lang === 'en' ? 'Dept' : 'แผนก'}</th>
                            <th style={{ padding: '4px', width: '80px' }}>{lang === 'en' ? 'Direction' : 'เที่ยวรถ'}</th>
                            <th style={{ padding: '4px' }}>{lang === 'en' ? 'Location' : 'จุดรับส่ง'}</th>
                            <th style={{ padding: '4px', width: '120px' }}>{lang === 'en' ? 'Roll-call (In/Out)' : 'เช็คชื่อ (มา/กลับ)'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!ride.seats || ride.seats.length === 0) ? (
                            <tr>
                              <td colSpan={8} style={{ padding: '6px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                                {lang === 'en' ? 'No passengers booked on this shift' : 'ไม่มีรายชื่อผู้โดยสารในรอบนี้'}
                              </td>
                            </tr>
                          ) : (
                            ride.seats.map(seat => {
                              const user = printPayload.userMap.get(seat.uid);
                              return (
                                <tr key={seat.seatNo} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '4px', fontWeight: 'bold' }}>{seat.seatNo}</td>
                                  <td style={{ padding: '4px' }}>{user?.employeeId || '-'}</td>
                                  <td style={{ padding: '4px' }}>{user?.fullName || seat.userFullName || '-'}</td>
                                  <td style={{ padding: '4px' }}>{user?.nickname || seat.userNickname || '-'}</td>
                                  <td style={{ padding: '4px' }}>{user?.department || '-'}</td>
                                  <td style={{ padding: '4px' }}>
                                    {seat.direction === 'inbound' ? 'Inbound' : seat.direction === 'outbound' ? 'Outbound' : 'Roundtrip'}
                                  </td>
                                  <td style={{ padding: '4px' }}>
                                    {seat.location === 'dormitory' ? 'Dormitory' : 'Kathu'}
                                  </td>
                                  <td style={{ padding: '4px' }}>
                                    In: {seat.inboundCheckedIn ? '✓' : '-'} | Out: {seat.outboundCheckedIn ? '✓' : '-'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Logistics Requests report */}
          {(printPayload.reportType === 'requests' || printPayload.reportType === 'all') && (
            <div style={{ marginBottom: '24px', pageBreakBefore: printPayload.reportType === 'all' ? 'always' : 'auto' }} className="print-section">
              <h2 style={{ fontSize: '1.1rem', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '12px' }}>
                {lang === 'en' ? 'Logistics & Errand Requests Details' : 'รายละเอียดการของานและคำขอรถทั่วไป'}
              </h2>
              {printPayload.requests.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>{lang === 'en' ? 'No request data matching criteria' : 'ไม่มีข้อมูลคำขอตรงตามที่เลือก'}</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #333', textAlign: 'left', fontWeight: 'bold' }}>
                      <th style={{ padding: '5px', width: '80px' }}>{lang === 'en' ? 'Date' : 'วันที่ใช้งาน'}</th>
                      <th style={{ padding: '5px', width: '70px' }}>{lang === 'en' ? 'Type' : 'ประเภท'}</th>
                      <th style={{ padding: '5px' }}>{lang === 'en' ? 'Title & Details' : 'หัวข้อและรายละเอียด'}</th>
                      <th style={{ padding: '5px', width: '120px' }}>{lang === 'en' ? 'Requester' : 'ผู้ขอ / แผนก'}</th>
                      <th style={{ padding: '5px', width: '130px' }}>{lang === 'en' ? 'Destination' : 'จุดรับส่ง / ปลายทาง'}</th>
                      <th style={{ padding: '5px', width: '70px' }}>{lang === 'en' ? 'Status' : 'สถานะ'}</th>
                      <th style={{ padding: '5px' }}>{lang === 'en' ? 'Completion Notes' : 'บันทึกเสร็จงาน'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printPayload.requests.map(req => {
                      let stopsText = '';
                      if (req.destinations && req.destinations.length > 0) {
                        stopsText = req.destinations.map((d, i) => `Stop ${i+1}: ${d.title || d.address}`).join(' -> ');
                      } else {
                        stopsText = req.destination || '';
                      }
                      
                      return (
                        <tr key={req.id} style={{ borderBottom: '1px solid #eee', pageBreakInside: 'avoid' }}>
                          <td style={{ padding: '5px', whiteSpace: 'nowrap' }}>{req.requestedDate} {req.requestedTime ? `at ${req.requestedTime}` : ''}</td>
                          <td style={{ padding: '5px' }}>{req.type}</td>
                          <td style={{ padding: '5px' }}>
                            <div style={{ fontWeight: 'bold' }}>{req.title}</div>
                            <div style={{ color: '#555', fontSize: '0.72rem' }}>{req.description}</div>
                          </td>
                          <td style={{ padding: '5px' }}>
                            <div>{req.requesterName}</div>
                            <div style={{ color: '#666', fontSize: '0.72rem' }}>{req.requesterDepartment}</div>
                          </td>
                          <td style={{ padding: '5px', fontSize: '0.72rem' }}>{stopsText}</td>
                          <td style={{ padding: '5px', textTransform: 'capitalize', fontWeight: '500' }}>{req.status}</td>
                          <td style={{ padding: '5px', fontSize: '0.72rem', color: '#333' }}>
                            {req.completedAt && (
                              <div style={{ fontStyle: 'italic' }}>
                                ✓ {lang === 'en' ? 'Done:' : 'เสร็จสิ้น:'} {req.completionNote || '-'}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatMonth(yyyyMM: string, lang: 'en' | 'th') {
  const [y, m] = yyyyMM.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleString(lang === 'en' ? 'en-US' : 'th-TH', { month: 'long', year: 'numeric' });
}
