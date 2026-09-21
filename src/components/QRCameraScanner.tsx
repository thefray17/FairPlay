import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface QRCameraScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export const QRCameraScanner: React.FC<QRCameraScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Initialize camera stream on user click
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera access is not supported on this browser or connection.');
      setIsLoading(false);
      return;
    }

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(() => {});
        }
        setIsLoading(false);

        // Check for multiple cameras only after camera access is granted
        if (navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
              if (!isMounted) return;
              const videoInputs = devices.filter((d) => d.kind === 'videoinput');
              setHasMultipleCameras(videoInputs.length > 1);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Camera access error:', err);
        setIsLoading(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission was denied. Please allow camera access in your browser settings to scan QR codes.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera detected on this device.');
        } else {
          setError('Could not access camera. Please check camera permissions.');
        }
      });

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [facingMode]);

  // Continuous QR scan loop
  useEffect(() => {
    let active = true;

    const scanFrame = () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (qrCode && qrCode.data && qrCode.data.trim().length > 0) {
              soundFx.playPointChime();
              active = false;
              onScan(qrCode.data.trim());
              return;
            }
          } catch (e) {
            console.error('QR scan decode error:', e);
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      active = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [onScan]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-400/50 shadow-xl flex flex-col items-center justify-center min-h-[280px] sm:min-h-[340px]">
      {/* Hidden offscreen canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video stream */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover absolute inset-0"
        playsInline
        muted
        autoPlay
      />

      {/* Dark vignette overlay */}
      <div className="absolute inset-0 bg-slate-950/40 pointer-events-none" />

      {/* Scanner aiming reticle */}
      {!error && (
        <div className="relative z-10 flex flex-col items-center justify-center p-4">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl border-2 border-yellow-400/80 shadow-[0_0_25px_rgba(250,204,21,0.35)] overflow-hidden bg-transparent">
            {/* Corner styling brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br-lg" />

            {/* Scanning laser beam animation */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_#fde047] animate-pulse duration-700 top-1/2 -translate-y-1/2" />
          </div>

          <p className="text-white text-xs font-black tracking-wide mt-3 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 shadow-sm flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            Align QR Code inside the frame
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-slate-950/80 flex flex-col items-center justify-center gap-2.5 text-white">
          <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
          <span className="text-xs font-black uppercase tracking-wider">Starting Camera...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="relative z-20 p-5 text-center max-w-sm mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-white">Camera Access Required</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase cursor-pointer"
            >
              Retry Camera
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase cursor-pointer"
            >
              Enter Manually
            </button>
          </div>
        </div>
      )}

      {/* Control buttons in header */}
      <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-2">
        {hasMultipleCameras && !error && (
          <button
            type="button"
            onClick={toggleCamera}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 shadow-md transition-colors cursor-pointer"
            title="Switch camera"
            aria-label="Switch camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 shadow-md transition-colors cursor-pointer"
          title="Close camera"
          aria-label="Close camera scanner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
