import { File } from "expo-file-system";
import { supabase } from "./supabase";

const BUCKET = "user-images";

function extFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return (match?.[1] ?? "jpg").toLowerCase();
}

function contentTypeFor(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

// Yerel (geçici) bir resmi Supabase Storage'a kalıcı olarak yükler ve
// depolama yolunu döner. Bu yol imageUri alanında saklanır — doğrudan
// görüntülenemez, önce getSignedImageUrl ile geçici bir linke çevrilmeli
// (bucket özel/private olduğu için).
export async function uploadUserImage(
  localUri: string,
  folder: "prescriptions" | "medicines"
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Giriş yapılmamış");

  const ext = extFromUri(localUri);
  const path = `${userId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bytes = await new File(localUri).bytes();

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: contentTypeFor(ext),
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Depolanan bir yol için geçici (imzalı) görüntüleme URL'i üretir.
export async function getSignedImageUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function deleteUserImage(path: string): Promise<void> {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}
