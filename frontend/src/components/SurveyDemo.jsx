import React, { useState } from 'react';
import SurveyForm from './SurveyForm';
import './SurveyForm.css';

/**
 * Demo component to showcase the SurveyForm
 * This can be used for testing and development
 */
const SurveyDemo = () => {
  const [showSurvey, setShowSurvey] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const handleSurveySubmit = (result) => {
    console.log('Survey submitted:', result);
    setSubmissionResult(result);
    setShowSurvey(false);
  };

  const handleSurveyCancel = () => {
    console.log('Survey cancelled');
    setShowSurvey(false);
  };

  const handleStartSurvey = () => {
    setSubmissionResult(null);
    setShowSurvey(true);
  };

  if (showSurvey) {
    return (
      <div className="survey-demo-container">
        <SurveyForm
          matchId="demo-match-123"
          playerFingerprint="demo-fingerprint-456"
          gameType="prisoners"
          onSubmit={handleSurveySubmit}
          onCancel={handleSurveyCancel}
        />
      </div>
    );
  }

  return (
    <div className="survey-demo-container">
      <div className="demo-content">
        <h1>Survey Component Demo</h1>
        <p>This is a demonstration of the survey form component.</p>
        
        {submissionResult && (
          <div className="submission-result">
            <h3>Survey Submission Result:</h3>
            <pre>{JSON.stringify(submissionResult, null, 2)}</pre>
          </div>
        )}
        
        <button 
          onClick={handleStartSurvey}
          className="demo-button"
        >
          Start Survey Demo
        </button>
      </div>
    </div>
  );
};

export default SurveyDemo;
