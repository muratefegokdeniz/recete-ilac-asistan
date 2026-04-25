import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Colors, Shadows, Radius } from "../constants/Colors";
import { FREQUENCY_OPTIONS, MEAL_TIMING_OPTIONS } from "../constants/MedicineOptions";

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
