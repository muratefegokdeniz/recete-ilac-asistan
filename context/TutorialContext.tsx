import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export interface TutorialRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TutorialStep {
  id: string;
  route: string;
  title: string;
  body: string;
  targetId: string | null;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "prescriptions",
    route: "/(tabs)/prescriptions",
    title: "Reçete",
    body: "Reçeteni fotoğrafla ya da elle gir — yapay zeka ilaçları, dozu, sıklığı ve yan etkileri senin için okur.",
    targetId: null,
  },
  {
    id: "cabinet",
    route: "/(tabs)/cabinet",
    title: "İlaç Dolabım",
    body: "Kullandığın ilaçları burada saklarsın; son kullanma tarihi yaklaşan ilaçlar için seni uyarırız.",
    targetId: null,
  },
  {
    id: "active",
    route: "/(tabs)/active",
    title: "İlaç Takip",
    body: "Düzenli kullandığın ilaçları buradan takip edersin: doz saatinde hatırlatma alır, \"Aldım\" ya da \"Atladım\" olarak işaretlersin.",
    targetId: null,
  },
  {
    id: "addChild",
    route: "/(tabs)/active",
    title: "Çocuk Ekle",
    body: "Yukarıdaki \"Çocuk Ekle\" butonundan çocuğunu ekleyip onun ilaç ve aşı takibini de aynı hesaptan yönetebilirsin.",
    targetId: "addChild",
  },
];

interface TutorialContextValue {
  active: boolean;
  stepIndex: number;
  currentStep: TutorialStep | null;
  highlightRect: TutorialRect | null;
  start: () => void;
  next: () => void;
  stop: () => void;
  reportHighlightTarget: (targetId: string, rect: TutorialRect | null) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<TutorialRect | null>(null);

  const start = useCallback(() => {
    setStepIndex(0);
    setHighlightRect(null);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setHighlightRect(null);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const nextIndex = i + 1;
      if (nextIndex >= TUTORIAL_STEPS.length) {
        setActive(false);
        setHighlightRect(null);
        return i;
      }
      setHighlightRect(null);
      return nextIndex;
    });
  }, []);

  const reportHighlightTarget = useCallback(
    (targetId: string, rect: TutorialRect | null) => {
      setHighlightRect((prev) => {
        const current = TUTORIAL_STEPS[stepIndex];
        if (!current || current.targetId !== targetId) return prev;
        return rect;
      });
    },
    [stepIndex]
  );

  const currentStep = active ? TUTORIAL_STEPS[stepIndex] ?? null : null;

  const value = useMemo(
    () => ({ active, stepIndex, currentStep, highlightRect, start, next, stop, reportHighlightTarget }),
    [active, stepIndex, currentStep, highlightRect, start, next, stop, reportHighlightTarget]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
