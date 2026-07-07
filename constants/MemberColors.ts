// Aile üyelerini birbirinden ayırt etmek için kullanılan renk paleti — durum
// renkleriyle (yeşil=alındı, kırmızı=atlandı, teal=primary) çakışmayacak tonlar.
// Kullanıcı çocuk eklerken burada listelenen renklerden birini seçer.
export const MEMBER_COLORS = [
  "#8B5CF6", "#F59E0B", "#EC4899", "#3B82F6",
  "#F97316", "#6366F1", "#0EA5E9", "#D946EF",
];

export function fallbackMemberColor(name: string, orderedNames: string[]): string {
  const idx = orderedNames.indexOf(name);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0]!;
}
