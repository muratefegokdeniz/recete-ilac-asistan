import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextInput,
  Platform,
} from "react-native";
import { Colors, Shadows, Radius } from "../constants/Colors";
import { FREQUENCY_OPTIONS, MEAL_TIMING_OPTIONS } from "../constants/MedicineOptions";
import DateTimePicker from "@react-native-community/datetimepicker";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.card, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading,
  disabled,
  style,
  textStyle,
  fullWidth,
}: ButtonProps) {
  const btnStyle = [
    styles.btn,
    styles[`btn_${variant}`],
    styles[`btn_${size}`],
    fullWidth && styles.fullWidth,
    disabled && styles.btnDisabled,
    style,
  ];

  const txtStyle = [
    styles.btnText,
    styles[`btnText_${variant}`],
    styles[`btnText_${size}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={btnStyle}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" || variant === "ghost" ? Colors.primary : Colors.textInverse}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.btnIcon}>{icon}</View>}
          <Text style={txtStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: "sm" | "md";
}

export function Badge({ label, color = Colors.primary, bgColor = Colors.primaryLight, size = "md" }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, size === "sm" && styles.badgeSm]}>
      <Text style={[styles.badgeText, { color }, size === "sm" && styles.badgeTextSm]}>
        {label}
      </Text>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

export function FrequencyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={pickerStyles.field}>
      <Text style={pickerStyles.label}>Sıklık</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={pickerStyles.row}>
          {FREQUENCY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[pickerStyles.chip, value === opt && pickerStyles.chipActive]}
              onPress={() => onChange(opt)}
              activeOpacity={0.7}
            >
              <Text style={[pickerStyles.chipText, value === opt && pickerStyles.chipTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function MealTimingPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={pickerStyles.field}>
      <Text style={pickerStyles.label}>Kullanım Zamanı</Text>
      <View style={pickerStyles.mealRow}>
        {MEAL_TIMING_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[pickerStyles.mealChip, active && pickerStyles.mealChipActive]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={pickerStyles.mealIcon}>{opt.icon}</Text>
              <Text style={[pickerStyles.mealLabel, active && pickerStyles.mealLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description && <Text style={styles.emptyDescription}>{description}</Text>}
      {action && (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="primary"
          style={styles.emptyAction}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  btn_primary: { backgroundColor: Colors.primary },
  btn_secondary: { backgroundColor: Colors.secondary },
  btn_outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  btn_danger: { backgroundColor: Colors.danger },
  btn_ghost: { backgroundColor: "transparent" },
  btn_sm: { paddingHorizontal: 12, paddingVertical: 8 },
  btn_md: { paddingHorizontal: 16, paddingVertical: 12 },
  btn_lg: { paddingHorizontal: 20, paddingVertical: 15 },
  btnDisabled: { opacity: 0.5 },
  fullWidth: { width: "100%" },
  btnIcon: { marginRight: 6 },
  btnText: { fontWeight: "600" },
  btnText_primary: { color: Colors.textInverse },
  btnText_secondary: { color: Colors.textInverse },
  btnText_outline: { color: Colors.primary },
  btnText_danger: { color: Colors.textInverse },
  btnText_ghost: { color: Colors.primary },
  btnText_sm: { fontSize: 13 },
  btnText_md: { fontSize: 15 },
  btnText_lg: { fontSize: 16 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeSm: { paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeTextSm: { fontSize: 11 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
  },
  sectionAction: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500",
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: 20,
    paddingHorizontal: 24,
  },
});

const pickerStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.text },

  row: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: "500", color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse, fontWeight: "700" },

  mealRow: { flexDirection: "row", gap: 8 },
  mealChip: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  mealChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  mealIcon: { fontSize: 20 },
  mealLabel: { fontSize: 12, fontWeight: "500", color: Colors.textSecondary, textAlign: "center" },
  mealLabelActive: { color: Colors.primary, fontWeight: "700" },
});

// ─── TimePickerField ──────────────────────────────────────────────────────────

export function TimePickerField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date | null>(null);

  const [h, m] = value.split(":").map(Number);
  const dateValue = new Date();
  dateValue.setHours(h ?? 8, m ?? 0, 0, 0);

  function toTimeStr(d: Date) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  if (Platform.OS === "web") {
    return (
      <View style={tpStyles.field}>
        {label && <Text style={tpStyles.label}>{label}</Text>}
        <TextInput
          style={tpStyles.webInput}
          value={value}
          onChangeText={onChange}
          placeholder="08:00"
          placeholderTextColor={Colors.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
      </View>
    );
  }

  return (
    <View style={tpStyles.field}>
      {label && <Text style={tpStyles.label}>{label}</Text>}
      <TouchableOpacity style={tpStyles.btn} onPress={() => { setIosTemp(dateValue); setShow(true); }} activeOpacity={0.75}>
        <Text style={tpStyles.clockIcon}>🕐</Text>
        <Text style={tpStyles.valueText}>{value}</Text>
        <Text style={tpStyles.chevron}>›</Text>
      </TouchableOpacity>

      {Platform.OS === "ios" ? (
        <Modal visible={show} transparent animationType="slide">
          <View style={tpStyles.iosOverlay}>
            <View style={tpStyles.iosSheet}>
              <View style={tpStyles.iosHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={tpStyles.iosCancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={tpStyles.iosTitle}>Saat Seç</Text>
                <TouchableOpacity onPress={() => {
                  if (iosTemp) onChange(toTimeStr(iosTemp));
                  setShow(false);
                }}>
                  <Text style={tpStyles.iosDoneText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosTemp ?? dateValue}
                mode="time"
                display="spinner"
                is24Hour
                locale="tr-TR"
                onChange={(_, d) => d && setIosTemp(d)}
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={dateValue}
            mode="time"
            display="default"
            is24Hour
            onChange={(_, d) => {
              setShow(false);
              if (d) onChange(toTimeStr(d));
            }}
          />
        )
      )}
    </View>
  );
}

// ─── DatePickerField ──────────────────────────────────────────────────────────

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date | null>(null);

  const dateValue = value ? new Date(value + "T12:00:00") : new Date();

  function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDisplay(iso: string) {
    if (!iso) return placeholder ?? "Tarih seç";
    const [y, mo, d] = iso.split("-");
    const MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    return `${d} ${MONTHS[(parseInt(mo ?? "1") - 1)] ?? ""} ${y}`;
  }

  if (Platform.OS === "web") {
    return (
      <View style={tpStyles.field}>
        <Text style={tpStyles.label}>{label}</Text>
        <TextInput
          style={tpStyles.webInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? "YYYY-MM-DD"}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
    );
  }

  return (
    <View style={tpStyles.field}>
      <Text style={tpStyles.label}>{label}</Text>
      <TouchableOpacity style={tpStyles.btn} onPress={() => { setIosTemp(dateValue); setShow(true); }} activeOpacity={0.75}>
        <Text style={tpStyles.clockIcon}>📅</Text>
        <Text style={[tpStyles.valueText, !value && { color: Colors.textMuted }]}>
          {formatDisplay(value)}
        </Text>
        <Text style={tpStyles.chevron}>›</Text>
      </TouchableOpacity>

      {Platform.OS === "ios" ? (
        <Modal visible={show} transparent animationType="slide">
          <View style={tpStyles.iosOverlay}>
            <View style={tpStyles.iosSheet}>
              <View style={tpStyles.iosHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={tpStyles.iosCancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={tpStyles.iosTitle}>Tarih Seç</Text>
                <TouchableOpacity onPress={() => {
                  if (iosTemp) onChange(toDateStr(iosTemp));
                  setShow(false);
                }}>
                  <Text style={tpStyles.iosDoneText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosTemp ?? dateValue}
                mode="date"
                display="spinner"
                locale="tr-TR"
                onChange={(_, d) => d && setIosTemp(d)}
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="default"
            onChange={(_, d) => {
              setShow(false);
              if (d) onChange(toDateStr(d));
            }}
          />
        )
      )}
    </View>
  );
}

const tpStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.text },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  clockIcon: { fontSize: 16 },
  valueText: { flex: 1, fontSize: 15, fontWeight: "600", color: Colors.text },
  chevron: { fontSize: 18, color: Colors.textMuted },
  webInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  iosOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  iosSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  iosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iosTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  iosCancelText: { fontSize: 15, color: Colors.textSecondary },
  iosDoneText: { fontSize: 15, fontWeight: "700", color: Colors.primary },
});

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Sil",
  onConfirm,
  onCancel,
  loading,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.dialog}>
          <Text style={confirmStyles.title}>{title}</Text>
          <Text style={confirmStyles.message}>{message}</Text>
          <View style={confirmStyles.buttons}>
            <TouchableOpacity style={confirmStyles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={confirmStyles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[confirmStyles.deleteBtn, loading && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={confirmStyles.deleteText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "700", color: Colors.text },
  message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  deleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.danger,
    alignItems: "center",
  },
  deleteText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
