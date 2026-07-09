'use client';

import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';

export default function ViewAsDropdown() {
  const { isActualMasterAdmin, impersonatedRole, setImpersonatedRole } = useAuth();

  if (!isActualMasterAdmin) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
      <select
        value={impersonatedRole || ''}
        onChange={(e) => setImpersonatedRole(e.target.value ? (e.target.value as UserRole) : null)}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          padding: '2px 8px',
          color: 'inherit',
          outline: 'none',
          cursor: 'pointer'
        }}
      >
        <option value="" style={{ color: '#000' }}>👁️ View As: Admin</option>
        <option value="hr" style={{ color: '#000' }}>HR</option>
        <option value="driver" style={{ color: '#000' }}>Driver</option>
        <option value="staff" style={{ color: '#000' }}>Staff</option>
      </select>
    </div>
  );
}
