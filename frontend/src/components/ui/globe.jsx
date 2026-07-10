import { useEffect, useRef } from "react";
import createGlobe from "cobe";

export function Globe({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let phi = 0;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 1000,
      height: 1000,
      phi: 0,
      theta: 0.15,
      dark: 1, // 1 for dark mode
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.1, 0.1, 0.15],
      markerColor: [0.145, 0.388, 0.921], // blue-600 color rgb(37, 99, 235) mapped to 0-1
      glowColor: [1, 1, 1],
      markers: [
        // Random global markers
        { location: [37.7595, -122.4367], size: 0.04 },
        { location: [40.7128, -74.0060], size: 0.08 },
        { location: [51.5074, -0.1278], size: 0.05 },
        { location: [35.6895, 139.6917], size: 0.08 },
        { location: [1.3521, 103.8198], size: 0.04 },
        { location: [28.6139, 77.2090], size: 0.07 },
      ],
      onRender: (state) => {
        // Called on every animation frame.
        state.phi = phi;
        phi += 0.003;
      }
    });

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <div className={`absolute inset-0 mx-auto aspect-[1/1] w-full max-w-[800px] flex items-center justify-center pointer-events-none ${className || ""}`}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          contain: "layout paint size",
          opacity: 1,
          transition: "opacity 1s ease",
        }}
      />
    </div>
  );
}
