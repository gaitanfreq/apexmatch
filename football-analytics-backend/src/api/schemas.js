const { z } = require('zod');

/** Convierte "39,140,135" en [39, 140, 135]; string vacío/ausente -> []. */
const leagueIdsQueryParam = z
  .string()
  .optional()
  .transform((val) => (val ? val.split(',').map(Number).filter((n) => Number.isFinite(n)) : []));

const withinHoursQueryParam = z.coerce.number().int().min(1).max(24 * 14).optional();

const upcomingWindowQuery = z.object({
  withinHours: withinHoursQueryParam,
  leagueIds: leagueIdsQueryParam,
});

const valueBetsQuery = z.object({
  withinHours: withinHoursQueryParam,
  leagueIds: leagueIdsQueryParam,
  minEdge: z.coerce.number().min(0).max(1).optional(),
});

const VALID_MATCH_STATUSES = ['scheduled', 'live', 'finished'];
const DEFAULT_STATUSES = ['scheduled', 'live'];

/** Convierte "scheduled,live" en ['scheduled','live'], filtrando valores inválidos; vacío/ausente -> default. */
const statusesQueryParam = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return DEFAULT_STATUSES;
    const parsed = val.split(',').map((s) => s.trim()).filter((s) => VALID_MATCH_STATUSES.includes(s));
    return parsed.length ? parsed : DEFAULT_STATUSES;
  });

const liveWindowQuery = z.object({
  withinHours: withinHoursQueryParam,
  leagueIds: leagueIdsQueryParam,
  statuses: statusesQueryParam,
});

const emailBody = z.object({
  email: z.string().email('Debe ser un email válido'),
});

const credentialsBody = z.object({
  email: z.string().email('Debe ser un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const bankrollSettingsBody = z.object({
  initialBankroll: z.coerce.number().positive('El bankroll inicial debe ser mayor a 0'),
  stakeUnitType: z.enum(['fixed', 'percentage']),
  stakeUnitValue: z.coerce.number().positive('La unidad de stake debe ser mayor a 0'),
});

const registerBetBody = z.object({
  matchLabel: z.string().trim().min(1, 'Indica el partido').max(200),
  market: z.string().trim().max(100).optional(),
  oddsDecimal: z.coerce.number().gt(1, 'La cuota debe ser mayor a 1'),
  stakeAmount: z.coerce.number().positive('El stake debe ser mayor a 0'),
  result: z.enum(['won', 'lost', 'void']),
  placedAt: z.string().datetime().optional(),
});

const betIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const userIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const updateUserTierBody = z.object({
  tier: z.enum(['free', 'vip', 'admin'], { errorMap: () => ({ message: "tier debe ser 'free', 'vip' o 'admin'" }) }),
});

module.exports = {
  upcomingWindowQuery,
  valueBetsQuery,
  liveWindowQuery,
  emailBody,
  credentialsBody,
  bankrollSettingsBody,
  registerBetBody,
  betIdParam,
  userIdParam,
  updateUserTierBody,
};
