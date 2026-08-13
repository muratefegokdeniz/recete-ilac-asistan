import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useTutorial } from "../context/TutorialContext";

// Eğitici bir butonu vurgularken (highlightRing) konumunu measureInWindow ile
// ölçüyoruz. Tek seferlik bir setTimeout'a güvenmek Android'de yanlış konum
// verebiliyordu: SafeAreaView'ın üst inset'i ilk framede 0 gelip biraz sonra
// gerçek değerine düzeltiliyor, buton bu düzeltmeyle aşağı kayıyor ama ölçüm
// daha önce alındığı için oval eski (daha yukarıdaki) konumda kalıp kalıyordu.
// Bu hook, timeout'a ek olarak ölçülen View'ın kendi onLayout'unu da dinliyor
// — layout gerçekten değiştiği her an (inset düzeltmesi dahil) ölçüm tazeleniyor.
export function useTutorialHighlight(targetId: string) {
  const ref = useRef<View>(null);
  const tutorial = useTutorial();
  const isActiveStep = tutorial.active && tutorial.currentStep?.targetId === targetId;

  function measure() {
    ref.current?.measureInWindow((x, y, width, height) => {
      tutorial.reportHighlightTarget(targetId, { x, y, width, height });
    });
  }

  useEffect(() => {
    if (!isActiveStep) return;
    const t = setTimeout(measure, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveStep, tutorial.stepIndex]);

  return { ref, onLayout: isActiveStep ? measure : undefined };
}
