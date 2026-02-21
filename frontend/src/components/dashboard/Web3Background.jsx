import Spline from '@splinetool/react-spline';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function Web3Background() {
  const [isLoading, setIsLoading] = useState(true);

  function onLoad(spline) {
    setIsLoading(false);
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-dark-bg pointer-events-none">
      {/* Placeholder Image (Blurred) - Visible while loading */}
      <div
        className={`absolute top-0 right-0 w-full h-full md:w-[80%] md:left-[35%] pointer-events-none z-10 transition-opacity duration-1000 ${isLoading ? 'opacity-100' : 'opacity-0'}`}
        style={{
          backgroundImage: 'url(/108ebb9f-2016-4f53-a2ea-f13920106176.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.8)', // Blur effect
          transform: 'scale(1.1)' // Scale up slightly to avoid blur edges
        }}
      />

      {/* Spline 3D Scene (Local File) */}
      <div
        className={`absolute top-0 right-0 w-full h-full md:w-[80%] md:left-[35%] pointer-events-none z-10 transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      >
        <Spline
          scene="/scene.splinecode"
          onLoad={onLoad}
          className="w-full h-full"
        />
      </div>

      {/* Gradient Overlay - Essential for text readability over 3D */}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-bg via-dark-bg/80 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-dark-bg/20 via-transparent to-dark-bg pointer-events-none" />
    </div>
  );
}
