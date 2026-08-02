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
  // true ise TutorialOverlay kendi kartını göstermez — ilgili ekran
  // (ör. reçete ekleme modalı) anlatımı kendi içinde gösterir.
  hostRendered?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "prescriptions-intro",
    route: "/(tabs)/prescriptions",
    title: "Reçete Ekle",
    body: "Yukarıdaki + butonuna dokun. Açılan pencerede \"Fotoğraf\" sekmesinde reçeteni kamerayla çekebilir ya da galeriden seçebilirsin; \"Manuel Giriş\" sekmesinden ise doktor, tarih ve ilaç adlarını elle yazabilirsin.",
    targetId: "prescriptionsAdd",
  },
  {
    id: "prescriptions-scanner",
    route: "/(tabs)/prescriptions",
    title: "Reçete Ekleme Ekranı",
    body: "Karşına bu ekran çıkıyor: üstte \"Fotoğraf\" ve \"Manuel Giriş\" sekmeleri var. Fotoğraf sekmesinde \"Kamera\" ile anında çekebilir ya da \"Galeri\"den mevcut bir fotoğrafı seçebilirsin.",
    targetId: null,
    hostRendered: true,
  },
  {
    id: "prescriptions-analysis",
    route: "/(tabs)/prescriptions",
    title: "AI Reçete Analizi",
    body: "Reçeteni yapay zeka analiz eder, ilaç adını, dozunu, kullanım sıklığını, kullanım şeklini ve yan etkilerini otomatik çıkarır. Yanlış okunan bir ilaç varsa \"Düzelt?\" ile ismini elle düzeltebilir, sonrasında \"Aktif İlaçlarıma Ekle\" ile doz hatırlatmalarını başlatabilirsin.",
    targetId: null,
    hostRendered: true,
  },
  {
    id: "cabinet-intro",
    route: "/(tabs)/cabinet",
    title: "İlaç Dolabım",
    body: "Kullandığın tüm ilaçları burada saklarsın; son kullanma tarihi yaklaşan ya da geçen ilaçlar için seni uyarırız. Yeni bir ilaç eklemek için yukarıdaki \"Ekle\" butonuna dokun.",
    targetId: "cabinetAdd",
  },
  {
    id: "cabinet-scanner",
    route: "/(tabs)/cabinet",
    title: "İlaç Ekleme Ekranı",
    body: "Karşına bu ekran çıkıyor: en üstte ilacın kutusunu \"Kamera\" ile çekebilir ya da \"Galeri\"den seçebilirsin. Fotoğraf olmadan da aşağıdaki formu elle doldurup ilacı kaydedebilirsin.",
    targetId: null,
    hostRendered: true,
  },
  {
    id: "cabinet-analysis",
    route: "/(tabs)/cabinet",
    title: "AI ile İlaç Ekleme",
    body: "İlacın kutusunu ya da prospektüsünü fotoğraflarsın (kamerayla ya da galeriden), yapay zeka ilaç adını, dozunu, kullanım sıklığını, ne için kullanıldığını ve son kullanma tarihini okuyup formu otomatik doldurur. Doldurulmayan ya da yanlış olan alanları (ör. adet, SKT) elle düzenleyip \"Dolaba Ekle\" ile kaydedersin.",
    targetId: null,
    hostRendered: true,
  },
  {
    id: "active",
    route: "/(tabs)/active",
    title: "İlaç Takip",
    body: "Düzenli kullandığın ilaçları buradan takip edersin: doz saatinde telefonuna hatırlatma bildirimi gelir, o ilacı \"Aldım\" ya da \"Atladım\" olarak işaretlersin. Atladığında istersen bir sebep de yazabilirsin.",
    targetId: null,
  },
  {
    id: "addChild",
    route: "/(tabs)/active",
    title: "Çocuk Ekle",
    body: "Yukarıdaki \"Çocuk Ekle\" butonundan çocuğunu ekleyip onun ilaç ve aşı takibini de aynı hesaptan yönetebilirsin. Çocuğun kendi telefonundan \"Aileme Bağlı Gir\" ile bağlanmasına izin verirsen, o da kendi ilaçlarını görüp \"Aldım/Atladım\" işaretleyebilir.",
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
