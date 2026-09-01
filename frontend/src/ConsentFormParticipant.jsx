import React, { useState, useEffect } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { ShieldAlert, ArrowLeft, CheckCircle } from "lucide-react"
import "./ConsentFormParticipant.css"

function ConsentFormParticipant() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [consentData, setConsentData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    const fetchConsent = async () => {
      try {
        const resp = await fetch(`/api/custom-rooms/experiments/${id}/consent/`)
        if (resp.ok) {
          const data = await resp.json()
          setConsentData(data)
        } else if (resp.status === 404) {
          // If no consent form exists, maybe we just skip or block. 
          // Based on rules, we enforce it. But if it happens to be missing, we should tell them.
          setError("This experiment does not have a consent form configured. You cannot join.")
        } else {
          setError("Failed to load consent form.")
        }
      } catch (err) {
        setError("Network error while loading consent form.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchConsent()
  }, [id])

  const handleAccept = () => {
    // Store acceptance in session storage so the home page knows they accepted
    sessionStorage.setItem(`consent_${id}`, "accepted")
    navigate(`/experiments/${id}/home`)
  }

  if (isLoading) {
    return (
      <div className="consent-page loading">
        <div className="spinner"></div>
        <p>Loading consent information...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="consent-page">
        <div className="consent-container">
          <Link to="/join-custom" className="back-link"><ArrowLeft size={18} /> Back to Lobby</Link>
          <div className="error-box" style={{marginTop: '2rem'}}>
            <ShieldAlert size={24} />
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="consent-page">
      <div className="consent-container">
        <Link to="/join-custom" className="back-link"><ArrowLeft size={18} /> Back to Lobby</Link>
        
        <div className="consent-card">
          <div className="consent-header">
            <ShieldAlert className="consent-icon" size={32} />
            <h1 className="consent-title">Participant Consent Form</h1>
            <p className="consent-subtitle">Please read the following information carefully before proceeding.</p>
          </div>

          <div className="consent-content">
            <section className="consent-section">
              <h2>Study Information</h2>
              <div className="info-grid">
                <div className="info-item"><strong>Study Title:</strong> {consentData.study_title}</div>
                <div className="info-item"><strong>Principal Investigator:</strong> {consentData.investigator}</div>
                <div className="info-item"><strong>Institution:</strong> {consentData.institution}</div>
                <div className="info-item"><strong>Contact Email:</strong> {consentData.contact_email}</div>
                {consentData.ethics_committee && <div className="info-item"><strong>Ethics Committee:</strong> {consentData.ethics_committee}</div>}
                {consentData.approval_number && <div className="info-item"><strong>Approval Number:</strong> {consentData.approval_number}</div>}
              </div>
              <div className="info-block" style={{marginTop: '1rem'}}>
                <strong>Purpose of the study:</strong>
                <p>{consentData.purpose}</p>
              </div>
            </section>

            <section className="consent-section">
              <h2>Participation</h2>
              <div className="info-grid">
                <div className="info-item"><strong>Estimated Duration:</strong> {consentData.duration_minutes} minutes</div>
                <div className="info-item"><strong>Participation Type:</strong> <span style={{textTransform: 'capitalize'}}>{consentData.participation_type}</span></div>
              </div>
              
              <div className="info-block" style={{marginTop: '1rem'}}>
                <strong>Eligibility Criteria:</strong>
                <ul className="criteria-list">
                  {consentData.eligibility_criteria?.min_age && <li>Minimum Age: {consentData.eligibility_criteria.min_age}</li>}
                  {consentData.eligibility_criteria?.countries && <li>Country Restriction: {consentData.eligibility_criteria.countries}</li>}
                  {consentData.eligibility_criteria?.language && <li>Language: {consentData.eligibility_criteria.language}</li>}
                  {consentData.eligibility_criteria?.other && <li>Other: {consentData.eligibility_criteria.other}</li>}
                  {!consentData.eligibility_criteria?.min_age && !consentData.eligibility_criteria?.countries && !consentData.eligibility_criteria?.language && !consentData.eligibility_criteria?.other && <li>No specific eligibility criteria listed.</li>}
                </ul>
              </div>
            </section>

            {consentData.compensation_enabled && (
              <section className="consent-section">
                <h2>Compensation</h2>
                <p><strong>Type:</strong> {consentData.compensation_type}</p>
                {consentData.compensation_description && <p>{consentData.compensation_description}</p>}
              </section>
            )}

            {(consentData.risks || consentData.benefits) && (
              <section className="consent-section">
                <h2>Risks and Benefits</h2>
                {consentData.risks && <div className="info-block"><strong>Risks:</strong><p>{consentData.risks}</p></div>}
                {consentData.benefits && <div className="info-block" style={{marginTop: '1rem'}}><strong>Benefits:</strong><p>{consentData.benefits}</p></div>}
              </section>
            )}

            <section className="consent-section">
              <h2>Data Collection & Storage</h2>
              <div className="info-block"><strong>What data will be collected?</strong><p>{consentData.data_collected}</p></div>
              <div className="info-block" style={{marginTop: '1rem'}}><strong>Who will have access?</strong><p>{consentData.data_access}</p></div>
              
              <div className="info-grid" style={{marginTop: '1rem'}}>
                <div className="info-item"><strong>Storage Duration:</strong> {consentData.storage_duration}</div>
                <div className="info-item"><strong>Post-experiment Survey:</strong> {consentData.post_experiment_survey ? "Included" : "Not included"}</div>
              </div>

              <div className="info-block" style={{marginTop: '1rem'}}>
                <strong>Future use of data:</strong>
                <ul className="criteria-list">
                  <li>Research use: {consentData.future_use?.research ? "Allowed" : "Not allowed"}</li>
                  <li>Sharing with collaborators: {consentData.future_use?.collaborators ? "Allowed" : "Not allowed"}</li>
                  <li>Public release (anonymized): {consentData.future_use?.public ? "Allowed" : "Not allowed"}</li>
                  <li>Educational use: {consentData.future_use?.educational ? "Allowed" : "Not allowed"}</li>
                  <li>Commercial collaborations: {consentData.future_use?.commercial ? "Allowed" : "Not allowed"}</li>
                </ul>
              </div>
            </section>

            {/* PLATFORM REQUIRED SECTION - CANNOT BE EDITED */}
            <section className="consent-section platform-required">
              <h2>Participant Rights (Platform Required)</h2>
              <div className="required-text">
                <p><strong>Participants have the right to terminate this session at any point and without any consequences. Data will be deleted at that time.</strong></p>
                <p>This study is hosted on the Social Interaction Lab platform. The platform may temporarily process technical information necessary to run the experiment, including IP addresses, browser information, and session identifiers. The platform does not use this information to identify participants.</p>
              </div>
            </section>
          </div>

          <div className="consent-footer">
            <label className="accept-checkbox">
              <input 
                type="checkbox" 
                checked={accepted} 
                onChange={(e) => setAccepted(e.target.checked)} 
              />
              <span>By accepting these terms and continuing to participate in the experiment, you agree that this consent for participation applies in full.</span>
            </label>
            
            <button 
              className={`accept-btn ${accepted ? 'active' : ''}`}
              disabled={!accepted}
              onClick={handleAccept}
            >
              {accepted ? <CheckCircle size={18} /> : null}
              Accept and Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsentFormParticipant
