/**
 * Konfigurationsdatei für den Frame Management Service.
 * Trennt Konfiguration (wie Ports) vom Code.
 * Diese Datei kann erweitert werden, um weitere Konfigurationsoptionen hinzuzufügen.
 */
export const config = {
  port: process.env.PORT || 3000,
};