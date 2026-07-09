'use client';

import { useState, useRef, useEffect } from 'react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  langDict: { cropTitle: string; cancel: string; apply: string };
}

export default function ImageCropperModal({ imageSrc, onCrop, onCancel, langDict }: ImageCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offX: 0, offY: 0 });

  const CROP_SIZE = 250;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // helpful if blob URL has issues, though usually fine for local blob
    img.onload = () => {
      setImage(img);
      // Initial scale to cover the crop area
      const s = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
      setScale(s);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    
    // Draw image centered and scaled, plus offset
    const w = image.width * scale;
    const h = image.height * scale;
    const dx = (CROP_SIZE - w) / 2 + offset.x;
    const dy = (CROP_SIZE - h) / 2 + offset.y;
    
    ctx.drawImage(image, dx, dy, w, h);
  }, [image, scale, offset]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, offX: offset.x, offY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.offX + dx, y: dragStart.current.offY + dy });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', padding: 20,
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        padding: 24, borderRadius: 'var(--radius-lg)', display: 'flex', 
        flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%', maxWidth: 400,
        boxShadow: 'var(--shadow-xl)', animation: 'slideUp 0.3s ease'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-1)' }}>{langDict.cropTitle}</h3>
        
        <div 
          style={{ 
            position: 'relative', width: CROP_SIZE, height: CROP_SIZE, 
            overflow: 'hidden', borderRadius: '50%', border: '2px dashed var(--color-accent-1)', 
            cursor: isDragging ? 'grabbing' : 'grab',
            background: 'var(--color-bg-1)'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <canvas 
            ref={canvasRef} 
            width={CROP_SIZE} 
            height={CROP_SIZE} 
            style={{ display: 'block', touchAction: 'none' }} 
          />
        </div>
        
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', textAlign: 'center' }}>Zoom</label>
          <input 
            type="range" min={0.1} max={3} step={0.01} value={scale} 
            onChange={e => setScale(parseFloat(e.target.value))} 
            style={{ width: '100%', accentColor: 'var(--color-accent-1)' }} 
          />
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center', marginTop: 8 }}>
          <button type="button" onClick={onCancel} className="btn-ghost" style={{ flex: 1 }}>{langDict.cancel}</button>
          <button type="button" onClick={handleSave} className="btn-gradient" style={{ flex: 1 }}>{langDict.apply}</button>
        </div>
      </div>
    </div>
  );
}
