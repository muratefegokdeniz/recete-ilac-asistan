// app.json'daki "name" alanı ASCII ("Ilac Asistani") tutuluyor, çünkü Xcode
// hedef adı buradan türetiliyor ve EAS CLI ile Expo prebuild Türkçe harfleri
// farklı dönüştürüyor: EAS "laAsistan", prebuild "IlacAsistani" üretiyordu.
// Bu uyumsuzluk build'i "Configure Xcode project" aşamasında düşürüyordu
// (build 13, SDK 58). Kullanıcının gördüğü ad ise bu plugin ile Türkçe
// karakterli haliyle yazılıyor.
const { withInfoPlist, withStringsXml, AndroidConfig } = require("@expo/config-plugins");

function withDisplayName(config, { displayName }) {
  config = withInfoPlist(config, (config) => {
    config.modResults.CFBundleDisplayName = displayName;
    return config;
  });

  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: "app_name" }, _: displayName }],
      config.modResults,
    );
    return config;
  });

  return config;
}

module.exports = withDisplayName;
