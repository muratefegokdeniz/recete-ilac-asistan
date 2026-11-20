# App Review Cevabı — Guideline 1.4.2 (Submission db9212ed-9152-47c1-a005-c4d2659b6296)

Yeni build yüklendikten SONRA, App Store Connect > ret mesajının altındaki
"Reply to App Review" ile gönder. Mesaja yeni build'den 2-3 ekran görüntüsü ekle
(reçete sonucu, "Doz reçetede belirtilmemiş" etiketi, sıklık seçme ekranı).
Hazır görseller: `store/review_reply/r1-…r3-….png`.

---

Hello,

Thank you for the review. We understand the concern under Guideline 1.4.2 and have removed every feature that could be seen as calculating or suggesting a drug dosage. A new build has been submitted with the following changes:

1. **No AI-generated dosages.** Previously, when a prescription did not state a dose, frequency or duration, the AI filled these fields in from general medical knowledge. This has been removed. The AI now only transcribes what is literally written on the user's own prescription. If a dose or frequency is not written there, the field stays empty and the app shows "Doz reçetede belirtilmemiş" (dose not specified on the prescription) with a note to ask a doctor or pharmacist.

2. **Medicine box scanning no longer returns dosage.** Scanning a medicine box now only reads the product name, active ingredient and expiry date for the user's home medicine cabinet. "Standard dose" and frequency suggestions were removed.

3. **Manual entry is no longer auto-completed.** When the user types medicine names, the app no longer adds doses or frequencies. The user enters what their doctor prescribed.

4. **The user chooses the frequency.** Before reminders are created, the user must select the frequency written on their prescription. The app only turns that choice into reminder times; it does not decide how much or how often to take a medicine.

5. **Missed-dose AI advice removed.** When a dose is skipped, the app now shows a fixed message telling the user not to double the dose and to check the package leaflet or ask their pharmacist or doctor.

6. **No body-weight input in onboarding.** We removed the height and weight step, along with the text that referred to dosage calculation.

7. **Assistant restricted.** The chat assistant is instructed never to provide doses, quantities, maximum daily amounts or weight-based calculations, and to refer such questions to a pharmacist or doctor.

8. **App Store screenshots and description updated** so they no longer show or mention dosage information.

İlaç Asistanı is now a personal prescription organizer and medication reminder: users keep their own prescriptions, a home medicine cabinet with expiry dates, and reminders based on what their doctor prescribed. The demo account in the App Review Information section has been reset with sample data that contains no generated dosage information.

Thank you for your time. We are happy to provide any additional information.

Best regards,
Murat Efe Gökdeniz
