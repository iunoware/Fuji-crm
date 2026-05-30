"use client";
import { useState, useEffect } from "react";

export default function LaunchScreen({ targetDate }: { targetDate: number }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      return difference > 0 ? difference : 0;
    };

    setTimeLeft(calculateTime());

    const interval = setInterval(() => {
      const diff = calculateTime();
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      document.body.style.overflow = "auto";
    };
  }, [targetDate]);

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div
      className="flex items-center justify-center min-h-screen w-screen p-5 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/images/login_background.jpeg')` }}
    >
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/60"></div>

      {/* Glassmorphism Card */}
      <div className="glass-card w-full max-w-150 rounded-3xl p-6 sm:p-12 shadow-2xl z-10 text-center box-border border border-white/20 bg-linear-to-br from-white/10 to-white/5 backdrop-blur-xl">
        <div className="bg-white w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
          <img
            src="/logos/logo.jpg"
            alt="Fuji Solar Logo"
            className="w-[80%] h-auto object-contain"
          />
        </div>

        <h1 className="text-white text-2xl sm:text-4xl font-extrabold mb-2 drop-shadow-md">
          Something Huge is Coming
        </h1>
        <p className="text-gray-200 text-sm sm:text-base mb-8 drop-shadow">
          The new Fuji Solar ERP & CRM Platform will go live in:
        </p>

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {[
            { label: "DAYS", value: days },
            { label: "HOURS", value: hours },
            { label: "MINUTES", value: minutes },
            { label: "SECONDS", value: seconds },
          ].map((time, index) => (
            <div
              key={index}
              className="flex-1 min-w-16.25 bg-black/40 border border-white/20 rounded-2xl p-3 sm:p-5 shadow-inner"
            >
              <div className="text-2xl sm:text-4xl font-extrabold text-white mb-2 font-mono leading-none">
                {time.value.toString().padStart(2, "0")}
              </div>
              <div className="text-[9px] sm:text-xs text-gray-400 font-bold tracking-wider">
                {time.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <span className="inline-block px-4 py-2 bg-brand-red/20 border border-brand-red/50 text-red-300 rounded-full text-xs font-bold tracking-wider">
            SYSTEM LOCKED UNTIL LAUNCH
          </span>
        </div>
      </div>
    </div>
  );
}
