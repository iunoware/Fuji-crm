"use client"
import { useState, useEffect } from 'react';
import LaunchScreen from './LaunchScreen';
import Maintenance from './Maintenance';

const INITIAL_LAUNCH_DATE = new Date('2026-05-20T12:30:00+05:30').getTime();
const MAINTENANCE_START = new Date('2026-05-13T16:00:00+05:30').getTime();
const MAINTENANCE_END = new Date('2026-05-13T18:30:00+05:30').getTime();

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [targetDate, setTargetDate] = useState(INITIAL_LAUNCH_DATE);
  const [isLaunched, setIsLaunched] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const checkStatus = () => {
      const now = new Date().getTime();

      // Check 1: Are we currently inside a Maintenance Window?
      if (now >= MAINTENANCE_START && now < MAINTENANCE_END) {
        setTargetDate(MAINTENANCE_END);
        setIsLaunched(false);
      }
      // Check 2: Are we past the target date? (Either Initial Launch OR Maintenance End)
      else if (now >= targetDate) {
        setIsLaunched(true);
      } else {
        setIsLaunched(false);
      }
    };

    checkStatus();
    const timer = setInterval(checkStatus, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!hasMounted) return null;

  if (!isLaunched) {
    return <LaunchScreen targetDate={targetDate} />;
  }

  const showMaintenance = new Date().getTime() < MAINTENANCE_START;

  return (
    <>
      {children}
      {showMaintenance && (
        <Maintenance maintenanceStart={MAINTENANCE_START} />
      )}
    </>
  );
}
