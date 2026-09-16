const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { computeMatchXG, samplePoisson, LEAGUE_ROSTERS, CLUB_RATINGS, LEAGUES } = require('../../src/ingestion/simulatorData');

describe('simulatorData.computeMatchXG', () => {
  test('un club más fuerte de local produce homeXG > awayXG', () => {
    const { homeXG, awayXG } = computeMatchXG('Real Madrid', 'Sevilla');
    assert.ok(homeXG > awayXG);
  });

  test('aplica ventaja de local: mismo club en ambos roles favorece al local', () => {
    const { homeXG, awayXG } = computeMatchXG('Liverpool', 'Liverpool');
    assert.ok(homeXG > awayXG);
  });

  test('lanza si el club no tiene rating', () => {
    assert.throws(() => computeMatchXG('Equipo Inventado', 'Real Madrid'));
    assert.throws(() => computeMatchXG('Real Madrid', 'Equipo Inventado'));
  });

  test('todos los clubes de cada roster de liga tienen rating definido', () => {
    for (const roster of Object.values(LEAGUE_ROSTERS)) {
      for (const club of roster) {
        assert.ok(CLUB_RATINGS[club], `falta rating para ${club}`);
      }
    }
  });

  test('las 4 ligas requeridas están definidas (Champions, Premier, La Liga, Serie A)', () => {
    assert.ok(LEAGUES.CHAMPIONS_LEAGUE);
    assert.ok(LEAGUES.PREMIER_LEAGUE);
    assert.ok(LEAGUES.LA_LIGA);
    assert.ok(LEAGUES.SERIE_A);
  });
});

describe('simulatorData.samplePoisson', () => {
  test('lambda <= 0 siempre da 0', () => {
    assert.equal(samplePoisson(0), 0);
    assert.equal(samplePoisson(-1), 0);
  });

  test('el promedio de muchas muestras converge cerca de lambda', () => {
    const lambda = 1.8;
    const n = 20000;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += samplePoisson(lambda);
    const mean = sum / n;
    assert.ok(Math.abs(mean - lambda) < 0.1, `media ${mean} muy lejos de lambda ${lambda}`);
  });

  test('siempre devuelve enteros no negativos', () => {
    for (let i = 0; i < 200; i += 1) {
      const k = samplePoisson(2.5);
      assert.ok(Number.isInteger(k) && k >= 0);
    }
  });
});
