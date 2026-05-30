/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Maintenance({ maintenanceStart }: { maintenanceStart: number }) {
  const calculateTimeLeft = () => {
    const difference = maintenanceStart - new Date().getTime();
    return difference > 0 ? Math.floor(difference / 1000) : 0;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timerId = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timerId);
  }, [maintenanceStart]);

  if (timeLeft <= 0) return null;

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed bottom-6 right-6 z-9999 bg-gray-900/85 backdrop-blur-md text-white px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl border border-white/15">
      <div className="bg-yellow-500/20 p-2.5 rounded-full flex">
        <AlertTriangle className="text-yellow-400" size={24} />
      </div>
      <div>
        <h4 className="m-0 text-xs font-bold text-red-300 uppercase tracking-wider">
          Maintenance Break In
        </h4>
        <div className="flex gap-1.5 text-xl font-extrabold font-mono text-white">
          <span>{hours.toString().padStart(2, "0")}h</span>:
          <span>{minutes.toString().padStart(2, "0")}m</span>:
          <span className="text-red-300">{seconds.toString().padStart(2, "0")}s</span>
        </div>
      </div>
    </div>
  );
}
