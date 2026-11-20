-- App Review demo hesabını sıfırla ve temiz örnek veriyle doldur.
--
-- Supabase Dashboard > SQL Editor'de çalıştır. Önce aşağıdaki demo_email
-- değerini App Store Connect > App Review Information'daki e-posta ile değiştir.
--
-- DOKUNMAZ: auth.users (e-posta + şifre), profiles, login_logs.
-- SİLER:    reçeteler, dolap ilaçları, aktif ilaçlar, alınan dozlar, sohbetler,
--           aile üyeleri, aşı kartları, çocuk bağlama istekleri, AI kullanım sayacı.
-- EKLER:    2 reçete, 4 dolap ilacı, 2 aktif ilaç (1'i çocuk için), 1 çocuk profili
--           ve aşı kartı.
--
-- Doz bilgisi ilkesi (Guideline 1.4.2): Doz/sıklık/süre yalnızca reçetede
-- "doktorun yazdığı" şekilde yer alıyor; dolap ilaçlarında doz alanları boş.
--
-- Tamamı tek transaction: herhangi bir adım hata verirse hiçbir şey değişmez.

DO $$
DECLARE
  demo_email text := 'DEMO_EMAIL_BURAYA';   -- <-- değiştir
  uid uuid;
  child_name text := 'Deniz';
  child_birth date := DATE '2025-06-01';
  rx1 jsonb;
  rx2 jsonb;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(demo_email);
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Demo hesabı bulunamadı: %', demo_email;
  END IF;

  -- ── Temizlik ──────────────────────────────────────────────────────────────
  DELETE FROM public.taken_doses         WHERE user_id = uid;
  DELETE FROM public.active_medicines    WHERE user_id = uid;
  DELETE FROM public.medicines           WHERE user_id = uid;
  DELETE FROM public.prescriptions       WHERE user_id = uid;
  DELETE FROM public.chat_conversations  WHERE user_id = uid;
  DELETE FROM public.child_vaccines      WHERE user_id = uid;
  DELETE FROM public.child_link_requests WHERE parent_user_id = uid;
  DELETE FROM public.family_members      WHERE user_id = uid;
  DELETE FROM public.ai_usage            WHERE user_id = uid;

  -- ── Reçeteler ─────────────────────────────────────────────────────────────
  rx1 := jsonb_build_object(
    'doctorName', 'Dr. Ayşe Yılmaz',
    'patientName', 'Demo Kullanıcı',
    'date', '12.11.2026',
    'rawText', 'Amoksisilin + Klavulanik Asit 1000 mg Film Tablet — 1x2, 7 gün, tok karnına. Parasetamol 500 mg Tablet — ağrı olduğunda.',
    'medicines', jsonb_build_array(
      jsonb_build_object(
        'name', 'Amoksisilin + Klavulanik Asit 1000 mg Film Tablet',
        'dosage', '1 tablet', 'frequency', 'Günde 2 kez', 'duration', '7 gün',
        'instructions', 'Tok karnına',
        'purpose', 'Bakteriyel enfeksiyonların tedavisinde kullanılan bir antibiyotiktir.',
        'sideEffects', 'İshal, bulantı, deride döküntü görülebilir.'),
      jsonb_build_object(
        'name', 'Parasetamol 500 mg Tablet',
        'dosage', NULL, 'frequency', 'Ağrı olduğunda', 'duration', NULL,
        'instructions', NULL,
        'purpose', 'Ağrı kesici ve ateş düşürücü olarak kullanılır.',
        'sideEffects', 'Genellikle iyi tolere edilir; nadiren alerjik reaksiyon görülebilir.')
    )
  );

  rx2 := jsonb_build_object(
    'doctorName', 'Dr. Mehmet Kaya (Çocuk Sağlığı)',
    'patientName', child_name,
    'date', '15.11.2026',
    'rawText', 'D Vitamini Damla — günde 1 kez 3 damla.',
    'medicines', jsonb_build_array(
      jsonb_build_object(
        'name', 'D Vitamini Damla',
        'dosage', '3 damla', 'frequency', 'Günde 1 kez', 'duration', NULL,
        'instructions', NULL,
        'purpose', 'D vitamini takviyesi olarak kullanılır.',
        'sideEffects', 'Önerilen şekilde kullanıldığında yan etki nadirdir.')
    )
  );

  INSERT INTO public.prescriptions (id, user_id, image_uri, analysis, saved_at)
  SELECT r.id, r.user_id, r.image_uri, r.analysis, r.saved_at
  FROM jsonb_populate_recordset(NULL::public.prescriptions, jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid, 'image_uri', NULL,
                       'analysis', rx1, 'saved_at', '2026-11-12T10:15:00Z'),
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid, 'image_uri', NULL,
                       'analysis', rx2, 'saved_at', '2026-11-15T14:30:00Z')
  )) r;

  -- ── İlaç dolabı (doz alanları bilerek boş) ────────────────────────────────
  INSERT INTO public.medicines (id, user_id, name, description, purpose, side_effects,
                                dosage, frequency, meal_timing, expiry_date, quantity,
                                image_uri, added_at)
  SELECT m.id, m.user_id, m.name, m.description, m.purpose, m.side_effects,
         m.dosage, m.frequency, m.meal_timing, m.expiry_date, m.quantity,
         m.image_uri, m.added_at
  FROM jsonb_populate_recordset(NULL::public.medicines, jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid,
      'name', 'Parasetamol 500 mg Tablet', 'purpose', 'Ağrı kesici ve ateş düşürücü.',
      'side_effects', 'Nadiren alerjik reaksiyon.', 'expiry_date', '2026-12-15',
      'quantity', 1, 'added_at', '2026-11-12T10:20:00Z'),
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid,
      'name', 'İbuprofen 400 mg Film Tablet', 'purpose', 'Ağrı, ateş ve iltihap için kullanılır.',
      'side_effects', 'Mide rahatsızlığı görülebilir.', 'expiry_date', '2027-08-31',
      'quantity', 1, 'added_at', '2026-10-02T09:00:00Z'),
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid,
      'name', 'Setirizin 10 mg Tablet', 'purpose', 'Alerjik belirtilerin giderilmesinde kullanılır.',
      'side_effects', 'Uyku hali görülebilir.', 'expiry_date', '2028-03-31',
      'quantity', 2, 'added_at', '2026-09-20T18:45:00Z'),
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid,
      'name', 'D Vitamini Damla', 'purpose', 'D vitamini takviyesi.',
      'side_effects', 'Önerilen şekilde kullanıldığında yan etki nadirdir.', 'expiry_date', '2027-05-31',
      'quantity', 1, 'added_at', '2026-11-15T14:40:00Z')
  )) m;

  -- ── Çocuk profili + aşı kartı ─────────────────────────────────────────────
  INSERT INTO public.family_members (id, user_id, name, color, age, gender)
  SELECT f.id, f.user_id, f.name, f.color, f.age, f.gender
  FROM jsonb_populate_record(NULL::public.family_members, jsonb_build_object(
    'id', 'fam_demo_' || substr(md5(random()::text), 1, 8), 'user_id', uid,
    'name', child_name, 'color', '#8B5CF6', 'age', 1, 'gender', 'Erkek'
  )) f;

  INSERT INTO public.child_vaccines (id, user_id, child_name, vaccine_name,
                                     recommended_age, due_date, completed_at, notification_id)
  SELECT 'vac_demo_' || s.ord || '_' || substr(md5(random()::text), 1, 6),
         uid, child_name, s.vaccine_name, s.recommended_age,
         (child_birth + make_interval(months => s.age_months))::date,
         CASE WHEN (child_birth + make_interval(months => s.age_months))::date < DATE '2026-11-19'
              THEN (child_birth + make_interval(months => s.age_months))::timestamptz END,
         NULL
  FROM (VALUES
    (1,  'Hepatit B (1. doz)', 'Doğumda', 0),
    (2,  'BCG (Verem)', '1. ay', 1),
    (3,  'Hepatit B (2. doz)', '1. ay', 1),
    (4,  'DaBT-İPA-Hib (1. doz)', '2. ay', 2),
    (5,  'KPA (1. doz)', '2. ay', 2),
    (6,  'DaBT-İPA-Hib (2. doz)', '4. ay', 4),
    (7,  'KPA (2. doz)', '4. ay', 4),
    (8,  'Hepatit B (3. doz)', '6. ay', 6),
    (9,  'DaBT-İPA-Hib (3. doz)', '6. ay', 6),
    (10, 'KPA (3. doz)', '6. ay', 6),
    (11, 'KKK (Kızamık-Kızamıkçık-Kabakulak)', '12. ay', 12),
    (12, 'Suçiçeği', '12. ay', 12),
    (13, 'KPA (Pekiştirme)', '12. ay', 12),
    (14, 'DaBT-İPA-Hib (Pekiştirme)', '18. ay', 18),
    (15, 'Hepatit A (1. doz)', '18. ay', 18),
    (16, 'Hepatit A (2. doz)', '24. ay', 24),
    (17, 'DaBT-İPA (Pekiştirme)', '48. ay (4 yaş)', 48),
    (18, 'KKK (Pekiştirme)', '48. ay (4 yaş)', 48),
    (19, 'Td (Pekiştirme)', '156. ay (13 yaş)', 156)
  ) AS s(ord, vaccine_name, recommended_age, age_months);

  -- ── Aktif ilaçlar (değerler reçetede yazanla birebir) ─────────────────────
  INSERT INTO public.active_medicines (id, user_id, medicine_id, medicine_name, dosage,
                                       frequency, meal_timing, start_date, end_date,
                                       reminder_times, notification_ids, notes, member_name)
  SELECT a.id, a.user_id, a.medicine_id, a.medicine_name, a.dosage,
         a.frequency, a.meal_timing, a.start_date, a.end_date,
         a.reminder_times, a.notification_ids, a.notes, a.member_name
  FROM jsonb_populate_recordset(NULL::public.active_medicines, jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid, 'medicine_id', NULL,
      'medicine_name', 'Amoksisilin + Klavulanik Asit 1000 mg Film Tablet',
      'dosage', '1 tablet', 'frequency', 'Günde 2 kez', 'meal_timing', 'tok',
      'start_date', '2026-11-17', 'end_date', '2026-11-23',
      'reminder_times', jsonb_build_array('09:00', '21:00'),
      'notes', 'Dr. Ayşe Yılmaz reçetesine göre (12.11.2026)', 'member_name', NULL),
    jsonb_build_object('id', gen_random_uuid()::text, 'user_id', uid, 'medicine_id', NULL,
      'medicine_name', 'D Vitamini Damla',
      'dosage', '3 damla', 'frequency', 'Günde 1 kez', 'meal_timing', 'farketmez',
      'start_date', '2026-11-15', 'end_date', NULL,
      'reminder_times', jsonb_build_array('10:00'),
      'notes', 'Dr. Mehmet Kaya reçetesine göre (15.11.2026)', 'member_name', child_name)
  )) a;

  RAISE NOTICE 'Demo hesabı sıfırlandı: % (%)', demo_email, uid;
END $$;
