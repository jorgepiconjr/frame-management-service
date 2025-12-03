/**
 * Configuration file for the Frame Management Service.
 * Separates configuration (such as ports) from code.
 * This file can be extended to add additional configuration options.
 */
export const config = {
  port: process.env.PORT || 3000,
};