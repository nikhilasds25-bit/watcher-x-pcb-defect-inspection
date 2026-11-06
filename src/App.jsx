import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:18080' : '')).replace(/\/$/, '');
const PROFILE_ORDER = ['deeppcb', 'dspcbsd_plus', 'pcb_defect_v2'];
const PROFILE_META = {
  deeppcb: { short: 'DeepPCB', title: 'DeepPCB specialist', geometry: 'HBB', imageSize: 640, confidence: 0.25, classHint: 'open · short · mousebite · spur · copper · pinhole', color: 'cyan', description: 'Six classes · horizontal bounding boxes' },
  dspcbsd_plus: { short: 'DsPCBSD+', title: 'DsPCBSD+ specialist', geometry: 'HBB', imageSize: 640, confidence: 0.25, classHint: 'SH · SP · SC · OP · MB · HB · CS · CFO · BMFO', color: 'violet', description: 'Nine classes · horizontal bounding boxes' },
  pcb_defect_v2: { short: 'PCB-Defect V2', title: 'PCB-Defect V2 specialist', geometry: 'OBB', imageSize: 1536, confidence: 0.5, classHint: 'missing pad · mouse bite · open circuit · short · spur · spurious copper', color: 'green', description: 'Six classes · oriented bounding boxes' },
};

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M20 16.5v2A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-2"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5"/><path d="M10 10h4v4h-4z"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
    external: <><path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    sliders: <><path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3"/><path d="M2 14h4m4-6h4m4 8h4"/></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m10 0h2a2 2 0 0 0 2-2v-2"/><path d="M8 12h8"/></>,
    brain: <><path d="M12 5a3 3 0 0 0-5.8-1A3.5 3.5 0 0 0 4 10a3 3 0 0 0 1 5.8A3.5 3.5 0 0 0 12 18"/><path d="M12 5a3 3 0 0 1 5.8-1A3.5 3.5 0 0 1 20 10a3 3 0 0 1-1 5.8A3.5 3.5 0 0 1 12 18M12 5v16m-4-11h4m4 3h-4"/></>,
    zoom: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7m-3.5-3.5h7"/></>,
  };
  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

function formatConfidence(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
function apiUrl(path) { if (!path) return '#'; const normalized = path.startsWith('/') ? path : `/${path}`; return API_BASE ? `${API_BASE}${normalized}` : normalized; }
function requireApiBase() { if (!API_BASE) throw new Error('Production API URL is not configured. Set VITE_API_BASE_URL in the Vercel project environment variables.'); }

async function postPrediction(profile, file, confidence, imgsz, thresholdProfile = 'global') {
  requireApiBase();
  const body = new FormData();
  body.append('profile', profile);
  body.append('file', file, file.name);
  body.append('threshold_profile', thresholdProfile);
  body.append('confidence', String(confidence));
  body.append('imgsz', String(imgsz));
  const response = await fetch(`${API_BASE}/predict`, { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return data;
}


function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function detectionPoints(detection) {
  if (detection?.geometry_type === 'OBB' && Array.isArray(detection.polygon_px) && detection.polygon_px.length >= 3) {
    return detection.polygon_px.map(([x, y]) => [Number(x), Number(y)]);
  }
  const box = detection?.bbox_xyxy_px?.map(Number);
  if (!box || box.length !== 4) return [];
  const [x1, y1, x2, y2] = box;
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}

function detectionBounds(detection) {
  const points = detectionPoints(detection);
  if (!points.length) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

function BoardLocator({ src, imageWidth, imageHeight, detections = [], selectedIndex, onSelect }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [pointerPosition, setPointerPosition] = useState(null);
  const [dimensionWarning, setDimensionWarning] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !imageWidth || !imageHeight) return undefined;
    const measure = () => {
      const availableWidth = Math.max(1, stage.clientWidth - 28);
      const availableHeight = Math.max(1, stage.clientHeight - 28);
      const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
      setFrameSize({ width: Math.max(1, imageWidth * scale), height: Math.max(1, imageHeight * scale) });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(stage);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [imageWidth, imageHeight]);

  const scale = frameSize.width > 0 ? frameSize.width / imageWidth : 1;
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeDetection = Number.isInteger(activeIndex) ? detections[activeIndex] : null;
  const activeBounds = activeDetection ? detectionBounds(activeDetection) : null;
  const activeCenter = activeBounds ? {
    x: (activeBounds.x1 + activeBounds.x2) / 2,
    y: (activeBounds.y1 + activeBounds.y2) / 2,
  } : null;

  const handlePointerMove = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1) * imageWidth;
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1) * imageHeight;
    setPointerPosition({ x: Math.round(x), y: Math.round(y) });
  };

  return (
    <>
      <div
        className="board-stage"
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => { setHoveredIndex(null); setPointerPosition(null); }}
      >
        {frameSize.width > 0 && <div
          className="board-canvas"
          ref={canvasRef}
          style={{ width: `${frameSize.width}px`, height: `${frameSize.height}px` }}
        >
          <img
            src={src}
            alt="Original PCB board with interactive detection regions"
            draggable="false"
            onLoad={(event) => {
              const image = event.currentTarget;
              setDimensionWarning(image.naturalWidth !== imageWidth || image.naturalHeight !== imageHeight);
            }}
          />
          <svg
            className="board-overlay"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="none"
            role="group"
            aria-label="Interactive PCB detection map"
          >
            {detections.map((detection, index) => {
              const points = detectionPoints(detection);
              const bounds = detectionBounds(detection);
              if (!points.length || !bounds) return null;
              const isSelected = index === selectedIndex;
              const isHovered = index === hoveredIndex;
              const polygonText = points.map(([x, y]) => `${x},${y}`).join(' ');
              const centerX = (bounds.x1 + bounds.x2) / 2;
              const centerY = (bounds.y1 + bounds.y2) / 2;
              const labelFont = Math.max(28, 11 / Math.max(scale, 0.001));
              return (
                <g
                  key={`${detection.class_id}-${index}`}
                  className={`board-hit-group${isSelected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${detection.class_name}, confidence ${formatConfidence(detection.confidence)}`}
                  onClick={(event) => { event.stopPropagation(); onSelect(index); }}
                  onPointerEnter={() => setHoveredIndex(index)}
                  onPointerLeave={() => setHoveredIndex((current) => current === index ? null : current)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(index); }
                  }}
                >
                  <polygon points={polygonText} className="board-detection-shape" />
                  <circle cx={centerX} cy={centerY} r={Math.max(26, 13 / Math.max(scale, 0.001))} className="board-index-disc" />
                  <text x={centerX} y={centerY + labelFont * 0.34} textAnchor="middle" fontSize={labelFont} className="board-index-label">{index + 1}</text>
                  <title>{`${detection.class_name} · ${formatConfidence(detection.confidence)}`}</title>
                </g>
              );
            })}
            {activeBounds && activeCenter && <g className="board-active-reticle">
              <circle cx={activeCenter.x} cy={activeCenter.y} r={Math.max(62, 33 / Math.max(scale, 0.001))} />
              <path d={`M ${activeCenter.x - 34 / Math.max(scale, 0.001)} ${activeCenter.y} H ${activeCenter.x + 34 / Math.max(scale, 0.001)} M ${activeCenter.x} ${activeCenter.y - 34 / Math.max(scale, 0.001)} V ${activeCenter.y + 34 / Math.max(scale, 0.001)}`} />
            </g>}
          </svg>
          {activeDetection && <div className="board-hover-readout">
            <span className="board-readout-index">{String(activeIndex + 1).padStart(2, '0')}</span>
            <span><b>{activeDetection.class_name}</b><small>{formatConfidence(activeDetection.confidence)} · {activeDetection.geometry_type}</small></span>
          </div>}
        </div>}
        {!frameSize.width && <div className="board-stage-loading">Fitting source image and coordinate overlay…</div>}
      </div>
      <div className="board-interaction-bar">
        <span><i className="board-interaction-dot"/> Hover a marker to inspect · Click to select a region</span>
        <span>{pointerPosition ? `X ${pointerPosition.x.toLocaleString()} · Y ${pointerPosition.y.toLocaleString()}` : `${imageWidth.toLocaleString()} × ${imageHeight.toLocaleString()} px`}</span>
      </div>
      {dimensionWarning && <p className="board-dimension-warning">Browser-decoded dimensions differ from the detector source dimensions. The source is fitted to the detector coordinate frame; verify this image's orientation before using the locator as inspection evidence.</p>}
      <div className="board-detection-picker" aria-label="Select a detected region">
        {detections.map((detection, index) => (
          <button
            key={`${detection.class_id}-${index}`}
            type="button"
            className={`board-region-chip${index === selectedIndex ? ' active' : ''}${index === hoveredIndex ? ' hovered' : ''}`}
            onClick={() => onSelect(index)}
            onPointerEnter={() => setHoveredIndex(index)}
            onPointerLeave={() => setHoveredIndex((current) => current === index ? null : current)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <b>{detection.class_name}</b>
            <small>{formatConfidence(detection.confidence)}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function App() {
  const [health, setHealth] = useState({ loading: true, online: false, gpu: 'Checking connection…' });
  const [profiles, setProfiles] = useState({});
  const [qwenStatus, setQwenStatus] = useState({ checked: false, available: false, model: 'Qwen2.5-VL-3B-Instruct' });
  const [mode, setMode] = useState('single');
  const [profile, setProfile] = useState('pcb_defect_v2');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [confidence, setConfidence] = useState(0.5);
  const [compareConfidence, setCompareConfidence] = useState(0.25);
  const [imgsz, setImgsz] = useState(1536);
  const [thresholdProfile, setThresholdProfile] = useState('global');
  const [busy, setBusy] = useState(false);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareProgress, setCompareProgress] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [compareResults, setCompareResults] = useState({});
  const [activeTab, setActiveTab] = useState('detections');
  const [zoom, setZoom] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [qwenResults, setQwenResults] = useState({});
  const [qwenBusy, setQwenBusy] = useState({});
  const [qwenErrors, setQwenErrors] = useState({});
  const [selectedQwenResults, setSelectedQwenResults] = useState({});
  const [selectedQwenBusy, setSelectedQwenBusy] = useState({});
  const [selectedQwenErrors, setSelectedQwenErrors] = useState({});
  const fileInputRef = useRef(null);

  const selectedMeta = PROFILE_META[profile];
  const classEntries = useMemo(() => Object.entries(result?.class_counts || {}).sort((a, b) => b[1] - a[1]), [result]);
  const zoomQwenKey = zoom ? `${zoom.modelResult.run_id}:${zoom.detectionIndex}` : '';
  const zoomQwenResult = zoomQwenKey ? selectedQwenResults[zoomQwenKey] : null;
  const zoomQwenBusy = zoomQwenKey ? Boolean(selectedQwenBusy[zoomQwenKey]) : false;
  const zoomQwenError = zoomQwenKey ? selectedQwenErrors[zoomQwenKey] : '';
  const zoomQwenAssessment = zoomQwenResult?.assessment || {};

  const refreshHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, loading: true }));
    try {
      requireApiBase();
      const [healthResponse, profileResponse, qwenResponse] = await Promise.all([
        fetch(`${API_BASE}/health`), fetch(`${API_BASE}/profiles`), fetch(`${API_BASE}/explain/status`).catch(() => null),
      ]);
      if (!healthResponse.ok || !profileResponse.ok) throw new Error(`API returned ${healthResponse.status}/${profileResponse.status}`);
      const healthData = await healthResponse.json();
      const profileData = await profileResponse.json();
      setHealth({ loading: false, online: healthData.status === 'ok', gpu: healthData.visible_gpu || (healthData.cuda_available ? 'CUDA available' : 'CPU mode') });
      setProfiles(profileData.profiles || {});
      if (qwenResponse?.ok) {
        const qwen = await qwenResponse.json();
        setQwenStatus({ checked: true, available: Boolean(qwen.available), model: qwen.model || 'Qwen2.5-VL-3B-Instruct', message: qwen.message || '' });
      } else {
        setQwenStatus({ checked: true, available: false, model: 'Qwen2.5-VL-3B-Instruct', message: 'Qwen API endpoint not installed yet.' });
      }
    } catch (err) {
      setHealth({ loading: false, online: false, gpu: 'API unavailable' });
      setError(`Cannot reach WATCHER-X API at ${API_BASE}. Check the DGX API terminal and SSH tunnel. ${err.message}`);
    }
  }, []);

  useEffect(() => { refreshHealth(); }, [refreshHealth]);
  useEffect(() => {
    const configured = PROFILE_META[profile];
    setConfidence(configured.confidence);
    setImgsz(configured.imageSize);
    setThresholdProfile('global');
  }, [profile]);
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const acceptFile = (candidate) => {
    setError(''); setResult(null); setCompareResults({}); setQwenResults({}); setQwenErrors({});
    setSelectedQwenResults({}); setSelectedQwenErrors({}); setSelectedQwenBusy({}); setZoom(null);
    if (!candidate) return;
    if (!candidate.type.startsWith('image/')) { setError('Please choose an image file (JPG, PNG, BMP, TIFF or WEBP).'); return; }
    if (candidate.size > 20 * 1024 * 1024) { setError('The API upload limit is 20 MB. Choose a smaller image.'); return; }
    setFile(candidate);
  };
  const handleDrop = (event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0]); };

  const handleSingleSubmit = async (event) => {
    event.preventDefault(); setError('');
    if (!file) { setError('Choose a PCB image before running inspection.'); return; }
    if (!health.online) { setError('WATCHER-X API is offline. Reconnect to the DGX API first.'); return; }
    setBusy(true); setResult(null); setQwenResults({}); setQwenErrors({});
    try {
      const data = await postPrediction(profile, file, confidence, imgsz, thresholdProfile);
      setResult(data); setActiveTab('detections');
    } catch (err) { setError(`Inspection failed: ${err.message}`); }
    finally { setBusy(false); }
  };

  const runComparison = async () => {
    setError('');
    if (!file) { setError('Choose a PCB image before running comparison.'); return; }
    if (!health.online) { setError('WATCHER-X API is offline. Reconnect to the DGX API first.'); return; }
    setCompareBusy(true); setResult(null); setCompareResults({}); setCompareProgress({}); setQwenResults({}); setQwenErrors({});
    // Run sequentially because the DGX API intentionally keeps one detector active in GPU memory at a time.
    for (const key of PROFILE_ORDER) {
      setCompareProgress((prev) => ({ ...prev, [key]: 'running' }));
      try {
        const meta = PROFILE_META[key];
        const data = await postPrediction(key, file, compareConfidence, meta.imageSize, 'global');
        setCompareResults((prev) => ({ ...prev, [key]: data }));
        setCompareProgress((prev) => ({ ...prev, [key]: 'done' }));
      } catch (err) {
        setCompareResults((prev) => ({ ...prev, [key]: { error: err.message } }));
        setCompareProgress((prev) => ({ ...prev, [key]: 'error' }));
      }
    }
    setCompareBusy(false);
  };

  const makeCrop = async (detection, modelResult) => {
    if (!previewUrl || !detection?.bbox_xyxy_px) return null;
    const image = new Image();
    image.src = previewUrl;
    await new Promise((resolve, reject) => {
      if (image.complete && image.naturalWidth) resolve();
      else { image.onload = resolve; image.onerror = reject; }
    });

    // Convert detector-space coordinates to the browser's decoded source dimensions.
    const modelWidth = Number(modelResult?.image_width || image.naturalWidth);
    const modelHeight = Number(modelResult?.image_height || image.naturalHeight);
    const scaleX = image.naturalWidth / modelWidth;
    const scaleY = image.naturalHeight / modelHeight;
    const [rawX1, rawY1, rawX2, rawY2] = detection.bbox_xyxy_px.map(Number);
    const x1 = rawX1 * scaleX;
    const y1 = rawY1 * scaleY;
    const x2 = rawX2 * scaleX;
    const y2 = rawY2 * scaleY;
    const boxWidth = Math.max(1, x2 - x1);
    const boxHeight = Math.max(1, y2 - y1);
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // A square crop preserves context around narrow mouse-bite/spur regions.
    const maxSide = Math.min(image.naturalWidth, image.naturalHeight);
    const side = Math.min(maxSide, Math.max(180, Math.max(boxWidth, boxHeight) * 3.2));
    const left = Math.max(0, Math.min(image.naturalWidth - side, centerX - side / 2));
    const top = Math.max(0, Math.min(image.naturalHeight - side, centerY - side / 2));
    const cropSide = Math.max(1, Math.min(side, image.naturalWidth - left, image.naturalHeight - top));

    const canvas = document.createElement('canvas');
    const outputSize = Math.max(420, Math.min(960, Math.round(cropSide * 1.6)));
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a crop canvas in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, left, top, cropSide, cropSide, 0, 0, outputSize, outputSize);
    return {
      url: canvas.toDataURL('image/jpeg', 0.94),
      bounds: { left, top, width: cropSide, height: cropSide },
    };
  };

  const openZoom = async (detection, modelResult, detectionIndex) => {
    try {
      const crop = await makeCrop(detection, modelResult);
      if (!crop?.url) throw new Error('Could not create a crop for this detection.');
      setCropZoom(1);
      setZoom({ cropUrl: crop.url, cropBounds: crop.bounds, detection, modelResult, detectionIndex });
    } catch (err) {
      setError(`Could not create defect crop: ${err.message}`);
    }
  };

  const handleBoardSelection = (detectionIndex) => {
    if (!zoom || detectionIndex === zoom.detectionIndex) return;
    const detection = zoom.modelResult.detections?.[detectionIndex];
    if (detection) openZoom(detection, zoom.modelResult, detectionIndex);
  };

  const explainSelectedDetection = async (selection) => {
    if (!selection?.modelResult?.run_id || !Number.isInteger(selection.detectionIndex)) return;
    const runId = selection.modelResult.run_id;
    const detectionIndex = selection.detectionIndex;
    const key = `${runId}:${detectionIndex}`;
    setSelectedQwenBusy((prev) => ({ ...prev, [key]: true }));
    setSelectedQwenErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      requireApiBase();
      const body = new FormData();
      body.append('detection_index', String(detectionIndex));
      body.append('max_detections', '1');
      body.append('explain_mode', 'quick');
      const response = await fetch(`${API_BASE}/explain/${runId}`, { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `Qwen explanation failed with HTTP ${response.status}`);
      const selected = (data.explanations || []).find((item) => item.detection_index === detectionIndex) || data.explanations?.[0];
      if (!selected) throw new Error('Qwen did not return an explanation for this selected detection.');
      setSelectedQwenResults((prev) => ({ ...prev, [key]: selected }));
    } catch (err) {
      setSelectedQwenErrors((prev) => ({ ...prev, [key]: err.message }));
    } finally {
      setSelectedQwenBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const explainRun = async (modelResult) => {
    if (!modelResult?.run_id) return;
    const runId = modelResult.run_id;
    setQwenBusy((prev) => ({ ...prev, [runId]: true }));
    setQwenErrors((prev) => ({ ...prev, [runId]: '' }));
    try {
      requireApiBase();
      const body = new FormData(); body.append('max_detections', '5');
      const response = await fetch(`${API_BASE}/explain/${runId}`, { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `Qwen explanation failed with HTTP ${response.status}`);
      setQwenResults((prev) => ({ ...prev, [runId]: data }));
    } catch (err) {
      setQwenErrors((prev) => ({ ...prev, [runId]: err.message }));
    } finally { setQwenBusy((prev) => ({ ...prev, [runId]: false })); }
  };

  const clearInspection = () => {
    setFile(null); setResult(null); setCompareResults({}); setCompareProgress({}); setError(''); setZoom(null);
    setQwenResults({}); setQwenErrors({}); setSelectedQwenResults({}); setSelectedQwenErrors({}); setSelectedQwenBusy({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderQwenPanel = (modelResult) => {
    const response = qwenResults[modelResult.run_id];
    const loading = qwenBusy[modelResult.run_id];
    const qwenError = qwenErrors[modelResult.run_id];
    return (
      <div className="qwen-panel">
        <div className="qwen-panel-head"><div><span className="step-label">03 / EXPLAINABILITY</span><h4>Qwen visual evidence assistant</h4></div><span className={`qwen-state ${qwenStatus.available ? 'ready' : 'offline'}`}>{qwenStatus.available ? 'MODEL CACHE READY' : 'OPTIONAL / NOT READY'}</span></div>
        <p className="qwen-disclaimer">Qwen describes visual evidence and assesses the detector candidate. It does not change YOLO class, confidence or geometry, and it cannot establish electrical continuity or root cause.</p>
        {!response && <button className="secondary-button qwen-button" type="button" onClick={() => explainRun(modelResult)} disabled={loading || !qwenStatus.available}>{loading ? <><span className="spinner"/> Explaining up to 5 detections…</> : <><Icon name="brain"/> Explain detections with Qwen</>}</button>}
        {!qwenStatus.available && <p className="field-note">{qwenStatus.message || 'Qwen endpoint is not available. The detector workflow remains fully usable.'}</p>}
        {qwenError && <div className="error-box"><Icon name="alert"/><span>{qwenError}</span></div>}
        {response && <div className="qwen-results">
          <div className="qwen-summary"><strong>{response.model || 'Qwen2.5-VL'}</strong><span>{response.explanations?.length || 0} regions explained</span></div>
          {(response.explanations || []).map((item) => <article className="explanation-card" key={`${item.detection_index}-${item.class_name}`}>
            <div className="explanation-title"><strong>#{item.detection_index + 1} · {item.class_name}</strong><span>{formatConfidence(item.confidence)}</span></div>
            <div className="explanation-tags"><span>{item.assessment?.candidate_compatibility || 'uncertain'}</span><span>{item.assessment?.evidence_strength || 'unknown'} evidence</span></div>
            <p>{item.assessment?.plain_language_explanation || item.assessment?.raw_text || 'No structured explanation returned.'}</p>
            {item.assessment?.supporting_visual_evidence && <p><b>Visual support:</b> {item.assessment.supporting_visual_evidence}</p>}
            {item.assessment?.missing_or_conflicting_evidence && <p><b>Limit / uncertainty:</b> {item.assessment.missing_or_conflicting_evidence}</p>}
            {item.assessment?.human_review_question && <p><b>Review question:</b> {item.assessment.human_review_question}</p>}
          </article>)}
          <p className="field-note">Human review remains required. These generated explanations are not ground truth.</p>
        </div>}
      </div>
    );
  };

  const renderDetectionList = (modelResult) => (
    <div className="compare-detections">
      {(modelResult.detections || []).length === 0 ? <p className="no-detections">No detections above the selected confidence threshold.</p> : (modelResult.detections || []).map((detection, index) => (
        <button type="button" className="mini-detection" key={`${detection.class_id}-${index}`} onClick={() => openZoom(detection, modelResult, index)}>
          <span className="mini-detection-main"><b>{detection.class_name}</b><small>{detection.geometry_type} · #{detection.class_id}</small></span>
          <span className="mini-confidence">{formatConfidence(detection.confidence)}</span>
          <span className="zoom-hint"><Icon name="zoom" size={14}/> Zoom</span>
        </button>
      ))}
    </div>
  );

  const renderResultCard = (key, modelResult) => {
    const meta = PROFILE_META[key];
    if (modelResult?.error) return <article className="compare-card" key={key}><div className="compare-card-head"><div><span className="step-label">{meta.geometry} SPECIALIST</span><h4>{meta.short}</h4></div><span className="pill-error">FAILED</span></div><div className="error-box">{modelResult.error}</div></article>;
    if (!modelResult) return <article className="compare-card pending-card" key={key}><div className="compare-card-head"><div><span className="step-label">{meta.geometry} SPECIALIST</span><h4>{meta.short}</h4></div><span className="qwen-state">{compareProgress[key] === 'running' ? 'RUNNING' : 'QUEUED'}</span></div><div className="pending-body"><span className="large-spinner"/><span>{compareProgress[key] === 'running' ? 'Running inference on DGX A100…' : 'Waiting for previous specialist…'}</span></div></article>;
    return <article className="compare-card" key={key}>
      <div className="compare-card-head"><div><span className="step-label">{meta.geometry} SPECIALIST / {modelResult.dataset}</span><h4>{meta.short}</h4></div><span className="pill-success">{modelResult.detection_count} DETECTIONS</span></div>
      <div className="compare-image-wrap"><img src={apiUrl(modelResult.annotated_image_url)} alt={`${meta.short} annotated prediction`} /></div>
      <div className="compare-card-meta"><span>Image {modelResult.image_width}×{modelResult.image_height}</span><span>Input {modelResult.imgsz}px</span><a href={apiUrl(modelResult.json_url)} target="_blank" rel="noreferrer">JSON <Icon name="external" size={12}/></a></div>
      <div className="compare-class-chips">{Object.entries(modelResult.class_counts || {}).map(([name, count]) => <span key={name}>{name} <b>{count}</b></span>)}</div>
      <div className="compare-detection-head"><strong>Detection evidence</strong><small>Click a detection to zoom its image crop</small></div>
      {renderDetectionList(modelResult)}
      <button className="secondary-button qwen-button" type="button" onClick={() => explainRun(modelResult)} disabled={qwenBusy[modelResult.run_id] || !qwenStatus.available || Boolean(qwenResults[modelResult.run_id])}>{qwenBusy[modelResult.run_id] ? 'Explaining…' : qwenResults[modelResult.run_id] ? 'Explanation ready' : 'Explain with Qwen'}</button>
      {qwenErrors[modelResult.run_id] && <p className="inline-error">{qwenErrors[modelResult.run_id]}</p>}
      {qwenResults[modelResult.run_id] && <div className="compact-qwen">{(qwenResults[modelResult.run_id].explanations || []).slice(0, 2).map((item) => <p key={item.detection_index}><b>{item.class_name}:</b> {item.assessment?.plain_language_explanation || item.assessment?.raw_text}</p>)}</div>}
    </article>;
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">W<span>X</span></div>
        <div className="side-nav"><div className="nav-item active" title="Inspection"><Icon name="grid"/></div><div className="nav-item" title="Image"><Icon name="image"/></div><div className="nav-item" title="Specialists"><Icon name="cpu"/></div><div className="nav-item" title="Analytics"><Icon name="chart"/></div></div>
        <div className="sidebar-bottom"><span className={`status-dot ${health.online ? 'online' : 'offline'}`}/></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div><div className="eyebrow">PCB QUALITY INTELLIGENCE PLATFORM</div><h1>Inspection workspace</h1></div><div className={`api-pill ${health.online ? 'is-online' : 'is-offline'}`}><span className="status-dot"/><span>{health.loading ? 'Connecting' : health.online ? 'API connected' : 'API offline'}</span><button className="refresh-button" type="button" onClick={refreshHealth}>Refresh</button></div></header>
        <section className="welcome-row"><div><div className="section-kicker">WATCHER-X / MULTI-SPECIALIST INFERENCE</div><h2>Inspect a printed circuit board.</h2><p>Three specialist detectors. Spatially accurate defect inspection. Evidence-first AI explanations.</p></div><div className="gpu-chip"><Icon name="cpu" size={16}/> {health.gpu}</div></section>

        <div className="mode-switch"><button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single specialist</button><button type="button" className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>Compare all 3 specialists</button><span className="mode-note">Comparison runs sequentially to keep DGX GPU memory predictable.</span></div>

        <div className="workspace-grid">
          <section className="panel config-panel">
            <div className="panel-heading"><div><span className="step-label">01 / CONFIGURE</span><h3>Inspection setup</h3></div><span className="panel-icon"><Icon name="sliders"/></span></div>
            <form onSubmit={mode === 'single' ? handleSingleSubmit : (e) => { e.preventDefault(); runComparison(); }}>
              {mode === 'single' ? <>
                <label className="field-label">Select specialist model</label>
                <div className="profile-list">{Object.entries(PROFILE_META).map(([key, meta], index) => <button type="button" key={key} className={`profile-option ${profile === key ? 'selected' : ''} ${meta.color}`} onClick={() => setProfile(key)}><span className="profile-number">0{index + 1}</span><span className="profile-copy"><strong>{meta.short}</strong><small>{meta.geometry} · {profiles[key]?.checkpoint_exists ? 'Checkpoint ready' : 'Checking checkpoint'}</small></span><span className="profile-check">{profile === key ? 'SELECTED' : 'SELECT'}</span></button>)}</div>
                <div className="class-hint">{selectedMeta.classHint}</div>
              </> : <>
                <label className="field-label">All specialists will inspect the same uploaded image</label>
                <div className="compare-profile-summary">{PROFILE_ORDER.map((key, index) => <div key={key}><span>0{index + 1}</span><b>{PROFILE_META[key].short}</b><small>{PROFILE_META[key].geometry} · {PROFILE_META[key].imageSize}px</small><i>{profiles[key]?.checkpoint_exists ? 'READY' : 'CHECKING'}</i></div>)}</div>
                <p className="field-note">Native class names and box geometry remain separate. Results are compared side by side, not merged into one unverified taxonomy.</p>
              </>}

              <label className="field-label upload-label">PCB image</label>
              <input ref={fileInputRef} className="file-input" type="file" accept="image/*" onChange={(e) => acceptFile(e.target.files?.[0])}/>
              <div className={`dropzone ${file ? 'has-file' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}>
                {previewUrl ? <img className="upload-preview" src={previewUrl} alt="Selected PCB preview"/> : <div className="upload-placeholder"><div className="upload-icon"><Icon name="upload" size={22}/></div><strong>Drop a PCB image here</strong><span>or browse files · JPG, PNG, TIFF, WEBP · up to 20 MB</span></div>}
                {file && <div className="file-meta"><span><Icon name="image" size={15}/> {file.name}</span><small>{(file.size / 1024).toFixed(1)} KB</small></div>}
              </div>

              <div className="settings-grid">
                <div className="setting-block"><label className="field-label" htmlFor="confidence">{mode === 'compare' ? 'Shared confidence threshold' : 'Confidence threshold'} <b>{Number(mode === 'compare' ? compareConfidence : confidence).toFixed(2)}</b></label><input id="confidence" type="range" min="0.05" max="0.95" step="0.05" value={mode === 'compare' ? compareConfidence : confidence} onChange={(e) => mode === 'compare' ? setCompareConfidence(Number(e.target.value)) : setConfidence(Number(e.target.value))}/><div className="range-labels"><span>0.05 · more candidates</span><span>0.95 · stricter</span></div></div>
                {mode === 'single' ? <div className="setting-block"><label className="field-label" htmlFor="imgsz">Inference image size</label><select id="imgsz" value={imgsz} onChange={(e) => setImgsz(Number(e.target.value))}>{[640, 960, 1280, 1536, 1920].map((size) => <option value={size} key={size}>{size}px</option>)}</select></div> : <div className="setting-block compare-info-block"><label className="field-label">Image sizes</label><div><b>640 / 640 / 1536 px</b><small>Model-specific default resolutions</small></div></div>}
              </div>
              {mode === 'single' && profile === 'pcb_defect_v2' && <div className="threshold-row"><label className="field-label" htmlFor="threshold-profile">Threshold profile</label><select id="threshold-profile" value={thresholdProfile} onChange={(e) => setThresholdProfile(e.target.value)}><option value="global">Global confidence</option><option value="validation_classwise">Class-wise (validation-calibrated)</option></select>{thresholdProfile === 'validation_classwise' && <p className="field-note">Uses frozen class-specific settings selected on validation data. Treat as a development calibration profile.</p>}</div>}
              {mode === 'compare' && <div className="compare-note"><Icon name="alert" size={15}/><span>The same threshold is applied to all models. Their taxonomies and box geometries differ, so detection counts are not direct accuracy scores.</span></div>}
              {error && <div className="error-box"><Icon name="alert" size={17}/><span>{error}</span></div>}
              <div className="form-actions"><button className="primary-button" type="submit" disabled={busy || compareBusy || !health.online || !file}>{mode === 'single' ? (busy ? <><span className="spinner"/> Inspecting…</> : <><Icon name="scan" size={18}/> Run inspection</>) : (compareBusy ? <><span className="spinner"/> Comparing…</> : <><Icon name="scan" size={18}/> Run 3-model comparison</>)}</button><button className="secondary-button" type="button" onClick={clearInspection}>Clear</button></div>
            </form>
            {mode === 'compare' && compareBusy && <div className="progress-list">{PROFILE_ORDER.map((key) => <div key={key}><span>{PROFILE_META[key].short}</span><b className={compareProgress[key] === 'done' ? 'done' : compareProgress[key] === 'error' ? 'failed' : ''}>{compareProgress[key] === 'done' ? 'Complete' : compareProgress[key] === 'error' ? 'Failed' : compareProgress[key] === 'running' ? 'Running…' : 'Queued'}</b></div>)}</div>}
            <div className="qwen-status-note"><Icon name="brain" size={15}/><span>Qwen explanation: {qwenStatus.available ? 'model cache ready' : qwenStatus.message || 'optional endpoint not configured'}.</span><button type="button" onClick={refreshHealth}>Check</button></div>
          </section>

          <section className="panel results-panel">
            <div className="panel-heading result-heading"><div><span className="step-label">02 / RESULTS</span><h3>{mode === 'single' ? 'Inspection results' : 'Specialist comparison'}</h3></div>{result && mode === 'single' && <span className="result-id">RUN {result.run_id?.slice(0, 8).toUpperCase()}</span>}{mode === 'compare' && Object.keys(compareResults).length > 0 && <span className="result-id">{Object.values(compareResults).filter((x) => !x.error).length} / 3 COMPLETE</span>}</div>

            {mode === 'single' && !result && !busy && <div className="empty-state"><div className="empty-graphic"><div className="scan-corner tl"/><div className="scan-corner tr"/><div className="scan-corner bl"/><div className="scan-corner br"/><Icon name="image" size={36}/></div><h4>Waiting for an inspection</h4><p>Upload a PCB image and run one specialist. Annotated detections and metadata will appear here.</p><div className="empty-meta"><span><Icon name="check" size={14}/> HBB + OBB support</span><span><Icon name="check" size={14}/> Click-to-zoom evidence</span></div></div>}
            {mode === 'single' && busy && <div className="loading-state"><span className="large-spinner"/><strong>Running specialist inference</strong><span>Image is being processed by the DGX A100.</span></div>}
            {mode === 'compare' && !compareBusy && Object.keys(compareResults).length === 0 && <div className="empty-state"><div className="empty-graphic"><Icon name="chart" size={36}/></div><h4>Compare the three specialists</h4><p>Upload one image, then run DeepPCB, DsPCBSD+ and PCB-Defect V2 in sequence. Each result keeps its native class labels and geometry.</p></div>}

            {mode === 'single' && result && <>
              <div className="result-stats"><div className="stat-card primary-stat"><span>DETECTIONS</span><strong>{result.detection_count}</strong><small>{result.dataset}</small></div><div className="stat-card"><span>GEOMETRY</span><strong>{result.geometry_type}</strong><small>{result.task?.toUpperCase()} task</small></div><div className="stat-card"><span>IMAGE SIZE</span><strong>{result.image_width}×{result.image_height}</strong><small>Original pixels</small></div></div>
              <div className="result-tabs"><button className={activeTab === 'detections' ? 'active' : ''} onClick={() => setActiveTab('detections')}>Annotated image</button><button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>Detection details</button></div>
              {activeTab === 'detections' ? <div className="annotated-wrap"><img src={apiUrl(result.annotated_image_url)} alt="WATCHER-X annotated PCB inspection"/><div className="image-actions"><a href={apiUrl(result.annotated_image_url)} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Open full image</a><a href={apiUrl(result.json_url)} target="_blank" rel="noreferrer"><Icon name="file" size={14}/> View JSON</a></div></div> : <div className="detection-table-wrap"><table className="detection-table"><thead><tr><th>CLASS</th><th>CONFIDENCE</th><th>GEOMETRY</th><th>LOCATION / ZOOM</th></tr></thead><tbody>{(result.detections || []).map((det, index) => <tr key={`${det.class_id}-${index}`}><td><span className="class-tag">{det.class_name}</span></td><td>{formatConfidence(det.confidence)}</td><td>{det.geometry_type}</td><td><button className="table-zoom" onClick={() => openZoom(det, result, index)}><Icon name="zoom" size={13}/> Zoom crop</button></td></tr>)}</tbody></table></div>}
              <div className="class-summary"><div className="summary-header"><span className="field-label">Detected defect classes</span><span>{classEntries.length} classes</span></div>{classEntries.length === 0 ? <p className="no-detections">No detections above the selected threshold.</p> : classEntries.map(([name, count]) => <div className="class-row" key={name}><span>{name}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(5, (count / Math.max(...classEntries.map((entry) => entry[1]))) * 100)}%` }}/></div><b>{count}</b></div>)}</div>
              {renderDetectionList(result)}
              {renderQwenPanel(result)}
              <div className="result-footer"><span><Icon name="check" size={15}/> Inference completed</span><span>{result.image}</span></div>
            </>}

            {mode === 'compare' && (compareBusy || Object.keys(compareResults).length > 0) && <>
              <div className="compare-overview"><div><b>{Object.values(compareResults).filter((x) => !x.error).length} / 3</b><span>specialists completed</span></div><div><b>{Object.values(compareResults).reduce((sum, x) => sum + (x?.detection_count || 0), 0)}</b><span>total candidate detections</span></div><div><b>{file?.name || 'PCB image'}</b><span>shared input image</span></div></div>
              <div className="compare-grid">{PROFILE_ORDER.map((key) => renderResultCard(key, compareResults[key]))}</div>
            </>}
          </section>
        </div>

        <section className="bottom-strip"><div><span className="strip-icon"><Icon name="cpu"/></span><div><strong>Three specialist models</strong><small>DeepPCB · DsPCBSD+ · PCB-Defect V2</small></div></div><div><span className="strip-icon"><Icon name="zoom"/></span><div><strong>Defect-level evidence</strong><small>Native HBB/OBB geometry · Click-to-zoom crops</small></div></div><div><span className="strip-icon"><Icon name="brain"/></span><div><strong>Evidence-first AI</strong><small>Optional Qwen2.5-VL explanation · Human review</small></div></div></section>
        <footer className="footer"><span>WATCHER-X / PREMIUM BUILD 0.4.0</span><span>Human review required · Model outputs are inspection assistance, not certification</span></footer>
      </main>

      {zoom && <div className="modal-backdrop" role="presentation" onClick={() => setZoom(null)}>
        <section className="zoom-modal zoom-inspector-modal" role="dialog" aria-modal="true" aria-label="Defect location and magnified evidence" onClick={(e) => e.stopPropagation()}>
          <div className="zoom-modal-head">
            <div>
              <span className="step-label">DEFECT INSPECTOR / {zoom.detection.geometry_type} · REGION {zoom.detectionIndex + 1}</span>
              <h3>{zoom.detection.class_name}</h3>
              <p className="zoom-subtitle">The highlighted marker shows where this detection sits on the original PCB.</p>
            </div>
            <button className="icon-button" type="button" onClick={() => setZoom(null)} aria-label="Close inspector"><Icon name="close"/></button>
          </div>

          <div className="zoom-inspector-grid">
            <section className="zoom-view-card">
              <div className="zoom-section-head"><span>01 / BOARD LOCATION</span><b>ORIGINAL IMAGE</b></div>
              <BoardLocator
                src={previewUrl}
                imageWidth={zoom.modelResult.image_width}
                imageHeight={zoom.modelResult.image_height}
                detections={zoom.modelResult.detections || []}
                selectedIndex={zoom.detectionIndex}
                onSelect={handleBoardSelection}
              />
              <div className="zoom-context-caption"><span className="zoom-marker-key"/> Selected region is highlighted; numbered markers are clickable.</div>
            </section>

            <section className="zoom-view-card">
              <div className="zoom-section-head"><span>02 / MAGNIFIED REGION</span><b>DETAIL VIEW</b></div>
              <div className="zoom-crop-toolbar" aria-label="Magnification controls">
                <span>Magnification</span>
                {[1, 1.5, 2, 3].map((factor) => <button key={factor} type="button" className={cropZoom === factor ? 'active' : ''} onClick={() => setCropZoom(factor)}>{factor}×</button>)}
              </div>
              <div className="zoom-crop-stage">
                <img src={zoom.cropUrl} style={{ transform: `scale(${cropZoom})` }} alt={`Magnified ${zoom.detection.class_name} region with surrounding PCB context`}/>
              </div>
              <div className="zoom-meta">
                <span>Confidence <b>{formatConfidence(zoom.detection.confidence)}</b></span>
                <span>Model <b>{zoom.modelResult.dataset}</b></span>
                <span>Class ID <b>{zoom.detection.class_id}</b></span>
              </div>
              <p className="zoom-context-caption">Magnified crop includes additional surrounding traces so the region is easier to recognise.</p>
            </section>
          </div>

          <section className="zoom-qwen-panel">
            <div className="zoom-qwen-heading">
              <div><span className="step-label">03 / SELECTED-DEFECT EXPLANATION</span><h4>Qwen visual evidence assistant</h4></div>
              <span className={`qwen-state ${qwenStatus.available ? 'ready' : 'offline'}`}>{qwenStatus.available ? 'MODEL CACHE READY' : 'NOT AVAILABLE'}</span>
            </div>
            <p className="qwen-disclaimer">Quick explanation for this selected region only. Qwen comments on visible evidence; it does not verify electrical continuity or change the YOLO prediction.</p>
            <button
              className="secondary-button qwen-button zoom-qwen-button"
              type="button"
              onClick={() => explainSelectedDetection(zoom)}
              disabled={!qwenStatus.available || zoomQwenBusy}
            >
              {zoomQwenBusy ? <><span className="spinner"/> Explaining selected defect…</> : zoomQwenResult ? 'Run explanation again' : <><Icon name="brain"/> Explain this defect with Qwen</>}
            </button>
            {!qwenStatus.available && <p className="field-note">{qwenStatus.message || 'Qwen is not available on the backend.'}</p>}
            {zoomQwenError && <div className="error-box"><Icon name="alert"/><span>{zoomQwenError}</span></div>}
            {zoomQwenResult && <article className="explanation-card zoom-selected-explanation">
              <div className="explanation-title">
                <strong>{zoomQwenAssessment.detector_candidate || zoom.detection.class_name} · {zoomQwenAssessment.candidate_compatibility || 'uncertain'}</strong>
                <span>{zoomQwenAssessment.evidence_strength || 'unknown'} evidence</span>
              </div>
              <p>{zoomQwenAssessment.plain_language_explanation || zoomQwenAssessment.raw_text || 'No structured explanation returned.'}</p>
              {zoomQwenAssessment.supporting_visual_evidence && <p><b>Supporting visual evidence:</b> {zoomQwenAssessment.supporting_visual_evidence}</p>}
              {zoomQwenAssessment.missing_or_conflicting_evidence && <p><b>Missing or conflicting evidence:</b> {zoomQwenAssessment.missing_or_conflicting_evidence}</p>}
              {zoomQwenAssessment.limitations && <p><b>Limitations:</b> {zoomQwenAssessment.limitations}</p>}
              {zoomQwenAssessment.human_review_question && <p><b>Human review question:</b> {zoomQwenAssessment.human_review_question}</p>}
              <p className="field-note">Quick, candidate-aware visual assistance—not ground truth. Human review remains required.</p>
            </article>}
          </section>
        </section>
      </div>}
    </div>
  );
}

export default App;
