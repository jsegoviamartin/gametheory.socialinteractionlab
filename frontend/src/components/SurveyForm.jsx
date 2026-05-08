import React, { useState } from 'react';
import './SurveyForm.css';

const SurveyForm = ({ matchId, playerFingerprint, gameType, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    nationality: '',
    residence: '',
    education: '',
    religion: '',
    meditation: '',
    meditation_years: '',
    punitive_God: '',
    game_theory: '',
    other: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Generate age options (1-100)
  const ageOptions = Array.from({ length: 100 }, (_, i) => i + 1);

  // Gender options
  const genderOptions = [
    'Male',
    'Female', 
    'Other',
    'Prefer not to say'
  ];

  // Education options
  const educationOptions = [
    'No formal education',
    'Primary education',
    'Secondary education (high school or equivalent)',
    'Vocational or technical training',
    'Bachelor\'s degree',
    'Master\'s degree',
    'Doctorate (PhD or equivalent)',
    'Prefer not to say'
  ];

  // Religion options
  const religionOptions = [
    'Buddhism',
    'Islam',
    'Christianity',
    'Hinduism',
    'Judaism',
    'No religion',
    'Other',
    'Prefer not to say'
  ];

  // Yes/No options
  const yesNoOptions = ['Yes', 'No'];

  // Meditation years options (0-100)
  const meditationYearsOptions = Array.from({ length: 101 }, (_, i) => i);

  // Country list (simplified - in production, you'd want a comprehensive list)
  const countries = [
    'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
    'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Brazil', 'Bulgaria', 'Canada', 'Chile', 'China',
    'Colombia', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Egypt', 'Estonia', 'Finland',
    'France', 'Georgia', 'Germany', 'Greece', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran',
    'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait',
    'Latvia', 'Lebanon', 'Lithuania', 'Luxembourg', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands',
    'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Philippines', 'Poland', 'Portugal',
    'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa',
    'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Thailand', 'Turkey', 'Ukraine',
    'United Arab Emirates', 'United Kingdom', 'United States', 'Vietnam', 'Other'
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.age) newErrors.age = 'Age is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.nationality) newErrors.nationality = 'Nationality is required';
    if (!formData.residence) newErrors.residence = 'Country of residence is required';
    if (!formData.education) newErrors.education = 'Education level is required';
    if (!formData.religion) newErrors.religion = 'Religion is required';
    if (!formData.meditation) newErrors.meditation = 'Meditation practice is required';
    if (!formData.punitive_God) newErrors.punitive_God = 'Punitive God belief is required';
    if (!formData.game_theory) newErrors.game_theory = 'Game theory familiarity is required';

    // Conditional validation for meditation years
    if (formData.meditation === 'Yes' && !formData.meditation_years) {
      newErrors.meditation_years = 'Please specify years of meditation practice';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Import the survey API service
      const { submitSurvey } = await import('../services/surveyApi');
      
      const response = await submitSurvey({
        matchId,
        playerFingerprint,
        gameType,
        surveyData: formData
      });

      if (response.status === 'success') {
        onSubmit(response);
      } else {
        setErrors({ submit: response.message || 'Failed to submit survey' });
      }
    } catch (error) {
      console.error('Survey submission error:', error);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="survey-form-container">
      <div className="survey-form-header">
        <h2>PLEASE COMPLETE SURVEY</h2>
        <p>We'd appreciate your feedback!</p>
      </div>

      <form onSubmit={handleSubmit} className="survey-form">
        {/* Age */}
        <div className="form-group">
          <label htmlFor="age">Age *</label>
          <select
            id="age"
            value={formData.age}
            onChange={(e) => handleInputChange('age', e.target.value)}
            className={errors.age ? 'error' : ''}
          >
            <option value="">Select age</option>
            {ageOptions.map(age => (
              <option key={age} value={age}>{age}</option>
            ))}
          </select>
          {errors.age && <span className="error-message">{errors.age}</span>}
        </div>

        {/* Gender */}
        <div className="form-group">
          <label htmlFor="gender">Gender *</label>
          <select
            id="gender"
            value={formData.gender}
            onChange={(e) => handleInputChange('gender', e.target.value)}
            className={errors.gender ? 'error' : ''}
          >
            <option value="">Select gender</option>
            {genderOptions.map(gender => (
              <option key={gender} value={gender}>{gender}</option>
            ))}
          </select>
          {errors.gender && <span className="error-message">{errors.gender}</span>}
        </div>

        {/* Nationality */}
        <div className="form-group">
          <label htmlFor="nationality">Nationality *</label>
          <select
            id="nationality"
            value={formData.nationality}
            onChange={(e) => handleInputChange('nationality', e.target.value)}
            className={errors.nationality ? 'error' : ''}
          >
            <option value="">Select nationality</option>
            {countries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
          {errors.nationality && <span className="error-message">{errors.nationality}</span>}
        </div>

        {/* Country of Residence */}
        <div className="form-group">
          <label htmlFor="residence">Country of residence *</label>
          <select
            id="residence"
            value={formData.residence}
            onChange={(e) => handleInputChange('residence', e.target.value)}
            className={errors.residence ? 'error' : ''}
          >
            <option value="">Select country of residence</option>
            {countries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
          {errors.residence && <span className="error-message">{errors.residence}</span>}
        </div>

        {/* Education */}
        <div className="form-group">
          <label htmlFor="education">Highest level of education *</label>
          <select
            id="education"
            value={formData.education}
            onChange={(e) => handleInputChange('education', e.target.value)}
            className={errors.education ? 'error' : ''}
          >
            <option value="">Select education level</option>
            {educationOptions.map(education => (
              <option key={education} value={education}>{education}</option>
            ))}
          </select>
          {errors.education && <span className="error-message">{errors.education}</span>}
        </div>

        {/* Religion */}
        <div className="form-group">
          <label htmlFor="religion">Main religion *</label>
          <select
            id="religion"
            value={formData.religion}
            onChange={(e) => handleInputChange('religion', e.target.value)}
            className={errors.religion ? 'error' : ''}
          >
            <option value="">Select religion</option>
            {religionOptions.map(religion => (
              <option key={religion} value={religion}>{religion}</option>
            ))}
          </select>
          {errors.religion && <span className="error-message">{errors.religion}</span>}
        </div>

        {/* Meditation Practice */}
        <div className="form-group">
          <label htmlFor="meditation">Do you practice meditation or mindfulness? *</label>
          <select
            id="meditation"
            value={formData.meditation}
            onChange={(e) => handleInputChange('meditation', e.target.value)}
            className={errors.meditation ? 'error' : ''}
          >
            <option value="">Select option</option>
            {yesNoOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.meditation && <span className="error-message">{errors.meditation}</span>}
        </div>

        {/* Meditation Years - Only show if meditation is Yes */}
        {formData.meditation === 'Yes' && (
          <div className="form-group">
            <label htmlFor="meditation_years">How many years have you practised meditation or mindfulness? *</label>
            <select
              id="meditation_years"
              value={formData.meditation_years}
              onChange={(e) => handleInputChange('meditation_years', e.target.value)}
              className={errors.meditation_years ? 'error' : ''}
            >
              <option value="">Select years</option>
              {meditationYearsOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {errors.meditation_years && <span className="error-message">{errors.meditation_years}</span>}
          </div>
        )}

        {/* Punitive God */}
        <div className="form-group">
          <label htmlFor="punitive_God">Do you believe in a God or a higher power that punishes immoral actions? *</label>
          <select
            id="punitive_God"
            value={formData.punitive_God}
            onChange={(e) => handleInputChange('punitive_God', e.target.value)}
            className={errors.punitive_God ? 'error' : ''}
          >
            <option value="">Select option</option>
            {yesNoOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.punitive_God && <span className="error-message">{errors.punitive_God}</span>}
        </div>

        {/* Game Theory Familiarity */}
        <div className="form-group">
          <label htmlFor="game_theory">Are you familiar with game‑theory experiments? *</label>
          <select
            id="game_theory"
            value={formData.game_theory}
            onChange={(e) => handleInputChange('game_theory', e.target.value)}
            className={errors.game_theory ? 'error' : ''}
          >
            <option value="">Select option</option>
            {yesNoOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.game_theory && <span className="error-message">{errors.game_theory}</span>}
        </div>

        {/* Other Comments */}
        <div className="form-group">
          <label htmlFor="other">Other comments</label>
          <textarea
            id="other"
            value={formData.other}
            onChange={(e) => handleInputChange('other', e.target.value)}
            placeholder="Optional: Any additional comments or feedback..."
            rows="4"
          />
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="error-message submit-error">{errors.submit}</div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="cancel-button"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'SUBMIT'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SurveyForm;
