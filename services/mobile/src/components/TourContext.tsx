import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isTourDismissed, resetTour } from '../offline/tour-storage';

interface TourContextValue {
  tourVisible: boolean;
  dismissTourUI: () => void;
  resetAndShowTour: () => Promise<void>;
}

const TourContext = createContext<TourContextValue>({
  tourVisible: false,
  dismissTourUI: () => {},
  resetAndShowTour: async () => {},
});

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tourVisible, setTourVisible] = useState(false);

  useEffect(() => {
    isTourDismissed().then((dismissed) => {
      if (!dismissed) setTourVisible(true);
    });
  }, []);

  const dismissTourUI = useCallback(() => setTourVisible(false), []);

  const resetAndShowTour = useCallback(async () => {
    await resetTour();
    setTourVisible(true);
  }, []);

  const value = useMemo(
    () => ({ tourVisible, dismissTourUI, resetAndShowTour }),
    [tourVisible, dismissTourUI, resetAndShowTour],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
