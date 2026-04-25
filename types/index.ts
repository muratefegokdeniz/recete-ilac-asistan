export interface Medicine {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  sideEffects?: string;
  dosage?: string;
  frequency?: string;
  mealTiming?: string;
  expiryDate?: string;
  quantity?: number;
  imageUri?: string;
  addedAt: string;
}

export interface ActiveMedicine {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  mealTiming?: string;
  startDate: string;
  endDate?: string;
  reminderTimes: string[];
  notificationIds?: string[];
  notes?: string;
  takenDoses: TakenDose[];
}

export interface TakenDose {
  id: string;
  scheduledTime: string;
  takenAt?: string;
  skipped?: boolean;
}

export interface PrescriptionAnalysis {
  medicines: PrescriptionMedicine[];
  doctorName?: string;
  patientName?: string;
  date?: string;
  rawText?: string;
}

export interface PrescriptionMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  purpose?: string;
  sideEffects?: string;
}

export interface SavedPrescription {
  id: string;
  imageUri?: string;
  analysis: PrescriptionAnalysis;
  savedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
