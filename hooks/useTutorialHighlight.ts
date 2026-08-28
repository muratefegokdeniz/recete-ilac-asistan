import { useEffect, useRef } from "react";
import { View, Platform, StatusBar } from "react-native";
import { useTutorial } from "../context/TutorialContext";

// Eğitici bir butonu vurgularken (highlightRing) konumunu measureInWindow ile
// ölçüyoruz. İki ayrı sorun vardı:
// 1. Tek seferlik bir setTimeout'a güvenmek Android'de yanlış konum
//    verebiliyordu (SafeAreaView'ın üst inset'i geç düzeltilebiliyor) — bunu
//    ölçülen View'ın kendi onLayout'unu da dinleyerek çözdük.
// 2. Asıl sorun bu değildi: app.json'da edgeToEdgeEnabled açık olduğu için
//    içerik artık status bar'ın arkasına kadar çiziliyor, ama Android'de
//    measureInWindow status bar'ı hâlâ hesaba KATMADAN (içerik alanının
//    başlangıcına göre) bir y döndürüyor. Overlay ise gerçek ekranın en
//    tepesinden (status bar dahil) başlıyor — bu fark, oval'in her zaman
//    tam status bar yüksekliği kadar yukarıda çizilmesine yol açıyordu.
//    Android'de StatusBar.currentHeight kadar aşağı kaydırarak düzeltiyoruz.
const ANDROID_STATUS_BAR_OFFSET = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

export function useTutorialHighlight(targetId: string) {
  const ref = useRef<View>(null);
  const tutorial = useTutorial();
  const isActiveStep = tutorial.active && tutorial.currentStep?.targetId === targetId;

  function measure() {
    ref.current?.measureInWindow((x, y, width, height) => {
      tutorial.reportHighlightTarget(targetId, { x, y: y + ANDROID_STATUS_BAR_OFFSET, width, height });
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
