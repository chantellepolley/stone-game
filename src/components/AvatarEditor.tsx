import { useState, useRef, useCallback, useEffect } from 'react';

interface AvatarEditorProps {
  file: File;
  onSave: (croppedFile: File) => void;
  onCancel: () => void;
}

export default function AvatarEditor({ file, onSave, onCancel }: AvatarEditorProps) {
  const [imgSrc, setImgSrc] = useState('');
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track drag and pinch state in refs to avoid stale closures
  const dragRef = useRef({ active: false, startX: 0, startY: 0, posX: 0, posY: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });

  // Load the file as a data URL
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
  }, [file]);

  // Preload image dimensions to center it
  useEffect(() => {
    if (!imgSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const circleSize = 250;
      const fitScale = Math.max(circleSize / img.width, circleSize / img.height);
      setScale(fitScale);
      setPos({
        x: (circleSize - img.width * fitScale) / 2,
        y: (circleSize - img.height * fitScale) / 2,
      });
    };
    img.src = imgSrc;
  }, [imgSrc]);

  // Native touch events for pinch + drag (avoids pointer event conflicts)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function getTouchDist(touches: TouchList) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch start
        pinchRef.current = { active: true, startDist: getTouchDist(e.touches), startScale: scale };
        dragRef.current.active = false;
      } else if (e.touches.length === 1) {
        // Drag start
        dragRef.current = { active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, posX: pos.x, posY: pos.y };
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 2 && pinchRef.current.active) {
        const dist = getTouchDist(e.touches);
        const newScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
        setScale(Math.max(0.1, Math.min(5, newScale)));
      } else if (e.touches.length === 1 && dragRef.current.active) {
        setPos({
          x: dragRef.current.posX + (e.touches[0].clientX - dragRef.current.startX),
          y: dragRef.current.posY + (e.touches[0].clientY - dragRef.current.startY),
        });
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current.active = false;
      if (e.touches.length === 0) dragRef.current.active = false;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pos, scale]);

  // Mouse drag (desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current.active) return;
      setPos({
        x: dragRef.current.posX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.posY + (ev.clientY - dragRef.current.startY),
      });
    }
    function onMouseUp() {
      dragRef.current.active = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [pos]);

  // Scroll to zoom (desktop)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(0.1, Math.min(5, prev - e.deltaY * 0.001)));
  }, []);

  // Crop and save
  const handleSave = async () => {
    if (!imgRef.current) return;
    setSaving(true);

    const outputSize = 256;
    const circleSize = 250;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;

    const ratio = outputSize / circleSize;
    ctx.drawImage(
      imgRef.current,
      pos.x * ratio,
      pos.y * ratio,
      imgRef.current.width * scale * ratio,
      imgRef.current.height * scale * ratio,
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        onSave(croppedFile);
      }
      setSaving(false);
    }, 'image/jpeg', 0.9);
  };

  if (!imgSrc) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
      <h2 className="text-white font-heading text-lg mb-4">Position Your Photo</h2>

      {/* Circle preview */}
      <div
        ref={containerRef}
        className="relative w-[250px] h-[250px] rounded-full overflow-hidden border-4 border-amber-600/60 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{ background: '#302b26', touchAction: 'none' }}
      >
        <img
          src={imgSrc}
          alt="Preview"
          className="absolute pointer-events-none select-none"
          draggable={false}
          style={{
            left: pos.x,
            top: pos.y,
            width: imgRef.current ? imgRef.current.width * scale : 'auto',
            height: imgRef.current ? imgRef.current.height * scale : 'auto',
            maxWidth: 'none',
          }}
        />
      </div>

      <p className="text-white/40 text-[10px] mt-2 mb-3">Drag to position. Pinch or scroll to zoom.</p>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 mb-4 w-64">
        <span className="text-white/40 text-xs">-</span>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.01"
          value={scale}
          onChange={e => setScale(parseFloat(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-white/40 text-xs">+</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                     bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors shadow-lg
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                     bg-black/30 text-white/60 hover:text-white cursor-pointer transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
