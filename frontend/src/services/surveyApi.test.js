import { submitSurvey } from './surveyApi'

test.each([
  { matchId: 'match', playerFingerprint: null },
  { matchId: null, playerFingerprint: 'participant' },
])('missing game context is caught before sending an invalid survey request', async (context) => {
  const originalFetch = global.fetch
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})
  global.fetch = jest.fn()
  try {
    await expect(submitSurvey({ ...context, gameType: 'prisoners', surveyData: {} })).rejects.toThrow(
      'Please return to the game and reopen the survey'
    )
    expect(global.fetch).not.toHaveBeenCalled()
  } finally {
    global.fetch = originalFetch
    errorLog.mockRestore()
  }
})
