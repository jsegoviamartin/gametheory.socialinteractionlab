import { getGameCsvFilename } from './downloadUtils'

test('uses the filename returned by the download endpoint', () => {
  const response = { headers: { get: () => 'attachment; filename="Public Goods.csv"' } }
  expect(getGameCsvFilename(response, 'prisoner')).toBe('Public Goods.csv')
})

test.each([
  ['prisoner', '2x2 Economic Games.csv'], ['ultimatum', 'Ultimatum.csv'],
  ['public_goods', 'Public Goods.csv'], ['common_pool', 'Common-Pool Resource.csv'], ['all', 'All Games.csv'],
])('%s fallback filename uses the visible game name', (gameType, filename) => {
  expect(getGameCsvFilename({ headers: { get: () => null } }, gameType)).toBe(filename)
})
