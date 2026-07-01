/**
 * Survey API service for submitting survey responses
 */

const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://gametheory.socialinteractionlab.org/api'
  : 'http://localhost:8001/api';

/**
 * Submit survey responses for a completed game
 * @param {Object} params - Survey submission parameters
 * @param {string} params.matchId - The match ID
 * @param {string} params.playerFingerprint - The player's fingerprint
 * @param {string} params.gameType - The game type ('prisoners', 'public-goods', 'common-pool', or 'ultimatum')
 * @param {Object} params.surveyData - The survey response data
 * @returns {Promise<Object>} API response
 */
export const submitSurvey = async ({ matchId, playerFingerprint, gameType, surveyData }) => {
  try {
    // Determine the correct endpoint based on game type
    let endpoint;
    if (gameType === 'prisoners') {
      endpoint = `${API_BASE_URL}/prisoners/submit_survey/`;
    } else if (gameType === 'public-goods') {
      endpoint = `${API_BASE_URL}/public-goods/submit-survey/`;
    } else if (gameType === 'common-pool') {
      endpoint = `${API_BASE_URL}/common-pool/submit-survey/`;
    } else {
      endpoint = `${API_BASE_URL}/ultimatum/submit-survey/`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        match_id: matchId,
        player_fingerprint: playerFingerprint,
        survey_data: surveyData
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Survey API error:', error);
    throw error;
  }
};

/**
 * Validate survey data before submission
 * @param {Object} surveyData - The survey data to validate
 * @returns {Object} Validation result with isValid boolean and errors object
 */
export const validateSurveyData = (surveyData) => {
  const errors = {};
  const requiredFields = [
    'age', 'gender', 'nationality', 'residence',
    'education', 'religion', 'meditation', 'punitive_God', 'game_theory'
  ];

  // Check required fields
  requiredFields.forEach(field => {
    if (!surveyData[field] || surveyData[field].trim() === '') {
      errors[field] = `${field} is required`;
    }
  });

  // Conditional validation for meditation years
  if (surveyData.meditation === 'Yes' && (!surveyData.meditation_years || surveyData.meditation_years === '')) {
    errors.meditation_years = 'Please specify years of meditation practice';
  }

  // Validate age range
  if (surveyData.age && (surveyData.age < 1 || surveyData.age > 100)) {
    errors.age = 'Age must be between 1 and 100';
  }

  // Validate meditation years range
  if (surveyData.meditation_years && (surveyData.meditation_years < 0 || surveyData.meditation_years > 100)) {
    errors.meditation_years = 'Meditation years must be between 0 and 100';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Get survey completion status for a match
 * @param {string} matchId - The match ID
 * @param {string} gameType - The game type ('prisoners', 'public-goods', 'common-pool', or 'ultimatum')
 * @returns {Promise<Object>} Survey completion status
 */
export const getSurveyStatus = async (matchId, gameType) => {
  // This would be implemented if we add a status endpoint.
  return {
    status: 'unknown',
    message: 'Survey status check not implemented'
  };
};

/**
 * Format survey data for submission
 * @param {Object} formData - Raw form data
 * @returns {Object} Formatted survey data
 */
export const formatSurveyData = (formData) => {
  const formatted = { ...formData };

  // Convert string numbers to integers where appropriate
  if (formatted.age) {
    formatted.age = parseInt(formatted.age, 10);
  }
  if (formatted.meditation_years) {
    formatted.meditation_years = parseInt(formatted.meditation_years, 10);
  }

  // Clean up empty strings
  Object.keys(formatted).forEach(key => {
    if (formatted[key] === '') {
      delete formatted[key];
    }
  });

  return formatted;
};

const surveyApi = {
  submitSurvey,
  validateSurveyData,
  getSurveyStatus,
  formatSurveyData
};

export default surveyApi;
