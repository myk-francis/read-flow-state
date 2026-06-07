import { useEffect, useRef } from "react";

export function useScreenWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const { wakeLock } = window.navigator;

    if (!wakeLock) {
      return;
    }

    let cancelled = false;

    const releaseWakeLock = async () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;

      if (!sentinel) {
        return;
      }

      try {
        await sentinel.release();
      } catch (error) {
        console.warn("Failed to release wake lock", error);
      }
    };

    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible" || sentinelRef.current) {
        return;
      }

      try {
        const sentinel = await wakeLock.request("screen");

        if (cancelled) {
          await sentinel.release();
          return;
        }

        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
          }
        });
      } catch (error) {
        console.warn("Failed to acquire screen wake lock", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        return;
      }

      void releaseWakeLock();
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [enabled]);
}
