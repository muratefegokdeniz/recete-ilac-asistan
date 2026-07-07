// T.C. Sağlık Bakanlığı genişletilmiş bağışıklama takvimine dayalı, basitleştirilmiş
// referans liste. "ageMonths" doğumdan itibaren geçmesi gereken ay sayısıdır — bir
// çocuk eklendiğinde bu liste her çocuk için due_date hesaplanarak child_vaccines
// tablosuna kopyalanır.
export interface VaccineScheduleItem {
  vaccineName: string;
  recommendedAge: string;
  ageMonths: number;
}

export const VACCINE_SCHEDULE: VaccineScheduleItem[] = [
  { vaccineName: "Hepatit B (1. doz)", recommendedAge: "Doğumda", ageMonths: 0 },
  { vaccineName: "BCG (Verem)", recommendedAge: "1. ay", ageMonths: 1 },
  { vaccineName: "Hepatit B (2. doz)", recommendedAge: "1. ay", ageMonths: 1 },
  { vaccineName: "DaBT-İPA-Hib (1. doz)", recommendedAge: "2. ay", ageMonths: 2 },
  { vaccineName: "KPA (1. doz)", recommendedAge: "2. ay", ageMonths: 2 },
  { vaccineName: "DaBT-İPA-Hib (2. doz)", recommendedAge: "4. ay", ageMonths: 4 },
  { vaccineName: "KPA (2. doz)", recommendedAge: "4. ay", ageMonths: 4 },
  { vaccineName: "Hepatit B (3. doz)", recommendedAge: "6. ay", ageMonths: 6 },
  { vaccineName: "DaBT-İPA-Hib (3. doz)", recommendedAge: "6. ay", ageMonths: 6 },
  { vaccineName: "KPA (3. doz)", recommendedAge: "6. ay", ageMonths: 6 },
  { vaccineName: "KKK (Kızamık-Kızamıkçık-Kabakulak)", recommendedAge: "12. ay", ageMonths: 12 },
  { vaccineName: "Suçiçeği", recommendedAge: "12. ay", ageMonths: 12 },
  { vaccineName: "KPA (Pekiştirme)", recommendedAge: "12. ay", ageMonths: 12 },
  { vaccineName: "DaBT-İPA-Hib (Pekiştirme)", recommendedAge: "18. ay", ageMonths: 18 },
  { vaccineName: "Hepatit A (1. doz)", recommendedAge: "18. ay", ageMonths: 18 },
  { vaccineName: "Hepatit A (2. doz)", recommendedAge: "24. ay", ageMonths: 24 },
  { vaccineName: "DaBT-İPA (Pekiştirme)", recommendedAge: "48. ay (4 yaş)", ageMonths: 48 },
  { vaccineName: "KKK (Pekiştirme)", recommendedAge: "48. ay (4 yaş)", ageMonths: 48 },
  { vaccineName: "Td (Pekiştirme)", recommendedAge: "156. ay (13 yaş)", ageMonths: 156 },
];
