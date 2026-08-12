// expo prebuild, bu projenin ayarlarıyla MainActivity.kt/MainApplication.kt
// dosyalarının içindeki "package ..." satırını yanlış üretiyor (ör.
// "com.ilaasistan" gibi bozuk bir değer — muhtemelen "scheme" alanından
// hatalı türetiliyor), oysa dosyaların bulunduğu klasör ve build.gradle'daki
// namespace/applicationId doğru (app.json'daki android.package). Bu uyumsuzluk
// Kotlin derlemesinde "Unresolved reference 'R'/'BuildConfig'" hatasına yol
// açıyor. Bu plugin, prebuild'in sonunda o satırı zorla doğru paket adıyla
// değiştiriyor.
const { withMainActivity, withMainApplication } = require("@expo/config-plugins");

function fixPackageLine(contents, pkg) {
  return contents.replace(/^package [^\s]+$/m, `package ${pkg}`);
}

function withFixAndroidPackage(config) {
  const pkg = config.android && config.android.package;
  if (!pkg) return config;

  config = withMainActivity(config, (config) => {
    config.modResults.contents = fixPackageLine(config.modResults.contents, pkg);
    return config;
  });

  config = withMainApplication(config, (config) => {
    config.modResults.contents = fixPackageLine(config.modResults.contents, pkg);
    return config;
  });

  return config;
}

module.exports = withFixAndroidPackage;
