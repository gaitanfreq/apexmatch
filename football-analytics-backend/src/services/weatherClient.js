const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const http = axios.create({
  baseURL: config.weather.baseUrl,
  timeout: 10000,
});

/**
 * Obtiene pronóstico de clima para una ubicación y hora de kickoff.
 * Devuelve null (en vez de lanzar) si el clima no está disponible: es un
 * factor secundario y no debe bloquear la ingesta del partido.
 */
async function getForecast({ latitude, longitude, kickoffAt }) {
  if (!config.weather.apiKey || !latitude || !longitude) return null;

  try {
    return await withRetry(
      async () => {
        const { data } = await http.get('/forecast', {
          params: {
            lat: latitude,
            lon: longitude,
            appid: config.weather.apiKey,
            units: 'metric',
          },
        });

        const target = new Date(kickoffAt).getTime();
        const closest = data.list.reduce((best, entry) => {
          const entryTime = entry.dt * 1000;
          const bestTime = best ? best.dt * 1000 : Infinity;
          return Math.abs(entryTime - target) < Math.abs(bestTime - target) ? entry : best;
        }, null);

        if (!closest) return null;

        return {
          temperatureCelsius: closest.main.temp,
          feelsLikeCelsius: closest.main.feels_like,
          humidityPct: closest.main.humidity,
          windSpeedKph: closest.wind.speed * 3.6,
          precipitationMm: closest.rain?.['3h'] ?? 0,
          condition: closest.weather?.[0]?.main?.toLowerCase() ?? 'unknown',
        };
      },
      { retries: 2, baseDelayMs: 800, label: 'WeatherAPI:forecast' }
    );
  } catch (err) {
    logger.warn('Weather forecast unavailable, continuing without it', { error: err.message });
    return null;
  }
}

module.exports = { getForecast };
