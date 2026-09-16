/**
 * Modelo de Poisson Bivariada para predicción de marcadores de fútbol.
 *
 * Referencia: Karlis & Ntzoufras (2003) "Analysis of sports data by using
 * bivariate Poisson models". El modelo bivariado añade un parámetro de
 * covarianza (lambda3) que captura la correlación entre los goles de ambos
 * equipos (ej. partidos con juego abierto tienden a tener más goles en ambos
 * lados) — algo que una Poisson independiente (lambda3=0) no puede modelar.
 *
 * X = Z1 + Z3,  Y = Z2 + Z3
 * Z1 ~ Poisson(lambda1), Z2 ~ Poisson(lambda2), Z3 ~ Poisson(lambda3), independientes
 *
 * P(X=x, Y=y) = e^-(l1+l2+l3) * sum_{k=0}^{min(x,y)} [ l1^(x-k)/(x-k)! * l2^(y-k)/(y-k)! * l3^k/k! ]
 */

const FACTORIAL_CACHE = [1];
function factorial(n) {
  if (n < 0) throw new RangeError('factorial: n must be >= 0');
  for (let i = FACTORIAL_CACHE.length; i <= n; i += 1) {
    FACTORIAL_CACHE[i] = FACTORIAL_CACHE[i - 1] * i;
  }
  return FACTORIAL_CACHE[n];
}

/** P(X=k) para una Poisson univariada de media lambda. */
function poissonPmf(lambda, k) {
  if (lambda < 0) throw new RangeError('poissonPmf: lambda must be >= 0');
  if (k < 0 || !Number.isInteger(k)) return 0;
  return Math.exp(-lambda) * lambda ** k / factorial(k);
}

/**
 * Deriva (lambda1, lambda2, lambda3) a partir de los xG estimados de cada
 * equipo y un coeficiente de correlación, preservando las medias marginales:
 * E[X] = lambda1 + lambda3 = homeXG,  E[Y] = lambda2 + lambda3 = awayXG.
 *
 * `correlation` es la fracción del menor de los dos xG que se atribuye al
 * componente compartido. 0 = independencia total (Poisson simple).
 */
function deriveBivariateLambdas(homeXG, awayXG, correlation = 0.12) {
  if (homeXG < 0 || awayXG < 0) throw new RangeError('xG values must be >= 0');
  if (correlation < 0 || correlation >= 1) throw new RangeError('correlation must be in [0, 1)');

  const lambda3 = correlation * Math.min(homeXG, awayXG);
  const lambda1 = Math.max(homeXG - lambda3, 0);
  const lambda2 = Math.max(awayXG - lambda3, 0);
  return { lambda1, lambda2, lambda3 };
}

/** P(X=x, Y=y) bajo el modelo de Poisson bivariada. */
function bivariatePoissonPmf(x, y, lambda1, lambda2, lambda3) {
  const maxK = Math.min(x, y);
  let sum = 0;
  for (let k = 0; k <= maxK; k += 1) {
    sum +=
      (lambda1 ** (x - k) / factorial(x - k)) *
      (lambda2 ** (y - k) / factorial(y - k)) *
      (lambda3 ** k / factorial(k));
  }
  return Math.exp(-(lambda1 + lambda2 + lambda3)) * sum;
}

/**
 * Construye la matriz de probabilidades P(home=x, away=y) para x,y en [0, maxGoals].
 * Se renormaliza para que la suma de la grilla truncada sea exactamente 1
 * (el remanente de probabilidad en marcadores > maxGoals es despreciable
 * para maxGoals >= 8 con xG realistas de fútbol, pero normalizamos para
 * evitar que errores de truncamiento se propaguen a los mercados derivados).
 */
function buildScoreMatrix({ homeXG, awayXG, correlation = 0.12, maxGoals = 10 }) {
  if (!Number.isInteger(maxGoals) || maxGoals < 1) {
    throw new RangeError('maxGoals must be a positive integer');
  }

  const { lambda1, lambda2, lambda3 } = deriveBivariateLambdas(homeXG, awayXG, correlation);

  const matrix = [];
  let total = 0;
  for (let x = 0; x <= maxGoals; x += 1) {
    const row = [];
    for (let y = 0; y <= maxGoals; y += 1) {
      const p = bivariatePoissonPmf(x, y, lambda1, lambda2, lambda3);
      row.push(p);
      total += p;
    }
    matrix.push(row);
  }

  if (total > 0) {
    for (let x = 0; x <= maxGoals; x += 1) {
      for (let y = 0; y <= maxGoals; y += 1) {
        matrix[x][y] /= total;
      }
    }
  }

  return matrix;
}

/** Suma de probabilidades donde total de goles (x+y) > line. Ej. line=2.5 -> Over 2.5. */
function overProbability(matrix, line) {
  let p = 0;
  for (let x = 0; x < matrix.length; x += 1) {
    for (let y = 0; y < matrix[x].length; y += 1) {
      if (x + y > line) p += matrix[x][y];
    }
  }
  return p;
}

function underProbability(matrix, line) {
  return 1 - overProbability(matrix, line);
}

/** P(ambos equipos anotan al menos 1 gol). */
function bttsYesProbability(matrix) {
  let p = 0;
  for (let x = 1; x < matrix.length; x += 1) {
    for (let y = 1; y < matrix[x].length; y += 1) {
      p += matrix[x][y];
    }
  }
  return p;
}

/** Top-N marcadores exactos más probables, ordenados descendentemente. */
function topCorrectScores(matrix, n = 5) {
  const flat = [];
  for (let x = 0; x < matrix.length; x += 1) {
    for (let y = 0; y < matrix[x].length; y += 1) {
      flat.push({ homeGoals: x, awayGoals: y, probability: matrix[x][y] });
    }
  }
  flat.sort((a, b) => b.probability - a.probability);
  return flat.slice(0, n);
}

const DEFAULT_OU_LINES = [0.5, 1.5, 2.5, 3.5];

/**
 * Agrega la matriz de marcadores en las probabilidades de mercado estándar
 * usadas por el resto del motor (1X2, doble oportunidad, over/under, BTTS).
 */
function aggregateMarketProbabilities(matrix, { ouLines = DEFAULT_OU_LINES } = {}) {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let x = 0; x < matrix.length; x += 1) {
    for (let y = 0; y < matrix[x].length; y += 1) {
      const p = matrix[x][y];
      if (x > y) homeWin += p;
      else if (x === y) draw += p;
      else awayWin += p;
    }
  }

  const overUnder = {};
  for (const line of ouLines) {
    const over = overProbability(matrix, line);
    overUnder[String(line)] = { over, under: 1 - over };
  }

  const bttsYes = bttsYesProbability(matrix);

  return {
    homeWin,
    draw,
    awayWin,
    doubleChance: {
      homeOrDraw: homeWin + draw,
      awayOrDraw: draw + awayWin,
      homeOrAway: homeWin + awayWin,
    },
    overUnder,
    btts: { yes: bttsYes, no: 1 - bttsYes },
  };
}

/**
 * Punto de entrada principal del modelo: dado el xG estimado de cada equipo,
 * devuelve la matriz de marcadores, las probabilidades de mercado agregadas
 * y los marcadores exactos más probables.
 */
function predictMatch({ homeXG, awayXG, correlation = 0.12, maxGoals = 10, topScoresCount = 5 }) {
  const matrix = buildScoreMatrix({ homeXG, awayXG, correlation, maxGoals });
  return {
    homeXG,
    awayXG,
    matrix,
    markets: aggregateMarketProbabilities(matrix),
    topScores: topCorrectScores(matrix, topScoresCount),
  };
}

module.exports = {
  factorial,
  poissonPmf,
  deriveBivariateLambdas,
  bivariatePoissonPmf,
  buildScoreMatrix,
  overProbability,
  underProbability,
  bttsYesProbability,
  topCorrectScores,
  aggregateMarketProbabilities,
  predictMatch,
};
