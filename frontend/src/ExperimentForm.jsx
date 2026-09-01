import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Save, Zap, Shield, Coins, Users, ShieldAlert, Target, TrendingUp, Info, Clipboard, HelpCircle, Waves } from "lucide-react"
import { getErrorMessage } from "./utils/errorUtils"
import "./ExperimentForm.css"

const Tooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="tooltip-wrapper">
      <HelpCircle 
        size={14} 
        className="help-icon" 
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && <div className="tooltip-bubble">{text}</div>}
    </div>
  );
};

const DEFAULT_CONDITION_DATA = {
  name: "Condition 1",
  room_name: "Prisoner's Dilemma",
  p1_cc: 20, p2_cc: 20,
  p1_cd: 0,  p2_cd: 30,
  p1_dc: 30, p2_dc: 0,
  p1_dd: 10, p2_dd: 10,
  prisoner_rounds: 25,
  endowment: 100,
  ultimatum_rounds: 10,
  ultimatum_game_type: "iterative",
  room_type: "basic",
  pg_endowment: 20,
  multiplier: 1.6,
  pg_rounds: 10,
  reward_cost: 4,
  reward_value: 12,
  punishment_cost: 4,
  punishment_value: 12,
  cpr_initial_fish_stock: 100,
  cpr_max_fish_stock: 100,
  cpr_max_extraction: 10,
  cpr_final_bonus_multiplier: 0.4,
  cpr_rounds: 20,
  cpr_reward_cost: 1.0,
  cpr_reward_value: 4.0,
  cpr_punishment_cost: 1.0,
  cpr_punishment_value: 4.0
}

const formatConditionParams = (cond, gameType) => {
  let params = { condition_name: cond.name }
  if (gameType === "prisoner") {
    params = { ...params, 
      room_name: cond.room_name, 
      p1_cc: cond.p1_cc, p2_cc: cond.p2_cc,
      p1_cd: cond.p1_cd, p2_cd: cond.p2_cd,
      p1_dc: cond.p1_dc, p2_dc: cond.p2_dc,
      p1_dd: cond.p1_dd, p2_dd: cond.p2_dd, 
      rounds: cond.prisoner_rounds 
    }
  } else if (gameType === "ultimatum") {
    params = { ...params, 
      endowment: cond.endowment, 
      rounds: cond.ultimatum_rounds,
      game_type: cond.ultimatum_game_type
    }
  } else if (gameType === "public_goods") {
    params = { ...params, 
      room_type: cond.room_type, 
      endowment: cond.pg_endowment, 
      multiplier: cond.multiplier, 
      rounds: cond.pg_rounds,
      reward_cost: cond.reward_cost,
      reward_value: cond.reward_value,
      punishment_cost: cond.punishment_cost,
      punishment_value: cond.punishment_value
    }
  } else {
    params = { ...params, 
      room_type: cond.room_type, 
      initial_fish_stock: cond.cpr_initial_fish_stock,
      max_fish_stock: cond.cpr_max_fish_stock,
      max_extraction: cond.cpr_max_extraction,
      final_bonus_multiplier: cond.cpr_final_bonus_multiplier,
      rounds: cond.cpr_rounds,
      reward_cost: cond.cpr_reward_cost,
      reward_value: cond.cpr_reward_value,
      punishment_cost: cond.cpr_punishment_cost,
      punishment_value: cond.cpr_punishment_value
    }
  }
  return params;
}

function ExperimentForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdCode, setCreatedCode] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [experimentId, setExperimentId] = useState(null)

  
  const [consentData, setConsentData] = useState({
    study_title: "", purpose: "", investigator: "", institution: "", contact_email: "",
    ethics_committee: "", approval_number: "", duration_minutes: 15, participation_type: "voluntary",
    eligibility_criteria: { min_age: "", countries: "", language: "", other: "" },
    compensation_enabled: false, compensation_type: "None", compensation_description: "",
    risks: "", benefits: "", data_collected: "", data_access: "", post_experiment_survey: true,
    storage_duration: "1 year", future_use: { research: false, collaborators: false, public: false, educational: false, commercial: false }
  })

  const [expData, setExpData] = useState({
    name: "",
    game_type: "prisoner",
  })

  const [isCustomStorage, setIsCustomStorage] = useState(false)
  const [isCustomCountry, setIsCustomCountry] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('edit')
    const expId = params.get('experimentId')
    const gType = params.get('gameType')

    if (editId) {
      setIsEditMode(true)
      setExperimentId(editId)
      fetchEditData(editId, true)
    } else if (expId && gType) {
      setExperimentId(expId)
      setExpData(prev => ({ ...prev, game_type: gType }))
      setStep(2)
      fetchEditData(expId, false)
    }
  }, [])

  const fetchEditData = async (id, isEditing) => {
    setIsLoading(true)
    const token = localStorage.getItem("access_token")
    try {
      const resp = await fetch(`/api/custom-rooms/experiments/${id}/`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (resp.ok) {
        const data = await resp.json()
        setExpData({ name: data.name, game_type: data.game_type });
        try {
          const cResp = await fetch(`/api/custom-rooms/experiments/${id}/consent/`);
          if (cResp.ok) {
            const cData = await cResp.json();
            setConsentData(cData);
            if (cData.storage_duration && !["1 year", "5 years", "10 years", "Indefinitely"].includes(cData.storage_duration)) {
              setIsCustomStorage(true);
            }
            if (cData.eligibility_criteria?.countries && !["", "US", "UK", "EU", "Canada", "Australia", "India", "Germany", "France", "Spain", "Italy", "China", "Japan", "Brazil"].includes(cData.eligibility_criteria.countries)) {
              setIsCustomCountry(true);
            }
          }
        } catch (e) {}

        
        if (isEditing) {
          const conditions = data.prisoner_conditions?.[0] || data.ultimatum_conditions?.[0] || data.public_goods_conditions?.[0] || data.common_pool_conditions?.[0]
          if (conditions) {
            setConditionData(prev => ({
              ...prev,
              ...conditions,
              name: conditions.condition_name,
              prisoner_rounds: conditions.rounds,
              ultimatum_rounds: conditions.rounds,
              ultimatum_game_type: conditions.game_type || "iterative",
              pg_rounds: conditions.rounds,
              pg_endowment: conditions.endowment,
              cpr_initial_fish_stock: conditions.initial_fish_stock || 100,
              cpr_max_fish_stock: conditions.max_fish_stock || 100,
              cpr_max_extraction: conditions.max_extraction || 10,
              cpr_final_bonus_multiplier: conditions.final_bonus_multiplier || 0.4,
              cpr_rounds: conditions.rounds,
              cpr_reward_cost: conditions.reward_cost || 1.0,
              cpr_reward_value: conditions.reward_value || 4.0,
              cpr_punishment_cost: conditions.punishment_cost || 1.0,
              cpr_punishment_value: conditions.punishment_value || 4.0,
            }))
          }
        } else {
          // Append mode: set name to next number
          const count = (data.prisoner_conditions?.length || 0) + 
                       (data.ultimatum_conditions?.length || 0) + 
                       (data.public_goods_conditions?.length || 0) +
                       (data.common_pool_conditions?.length || 0)
          setConditionData(prev => ({ ...prev, name: `Condition ${count + 1}` }))
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const [conditionData, setConditionData] = useState(DEFAULT_CONDITION_DATA)
  const [conditionsList, setConditionsList] = useState([])

  const applyPreset = (game) => {
    if (game === 'pd') {
      updateCondition({ room_name: "Prisoner's Dilemma", p1_cc: 20, p2_cc: 20, p1_cd: 0, p2_cd: 30, p1_dc: 30, p2_dc: 0, p1_dd: 10, p2_dd: 10 })
    } else if (game === 'stag') {
      updateCondition({ room_name: "Stag Hunt", p1_cc: 10, p2_cc: 10, p1_cd: 1, p2_cd: 8, p1_dc: 8, p2_dc: 1, p1_dd: 5, p2_dd: 5 })
    } else if (game === 'bos1') {
      updateCondition({ room_name: "Battle of the Sexes (1)", p1_cc: 30, p2_cc: 20, p1_cd: 0, p2_cd: 0, p1_dc: 0, p2_dc: 0, p1_dd: 20, p2_dd: 30 })
    } else if (game === 'bos2') {
      updateCondition({ room_name: "Battle of the Sexes (2)", p1_cc: 30, p2_cc: 20, p1_cd: 10, p2_cd: 10, p1_dc: 0, p2_dc: 0, p1_dd: 20, p2_dd: 30 })
    }
  }

  const updateCondition = (fields) => setConditionData({...conditionData, ...fields})

  const handleNext = async () => {
    if (step === 1 && !expData.name) {
      setError("Please enter a name")
      return
    }

    // Early duplicate check for new experiments
    if (step === 1 && !experimentId) {
      setIsLoading(true)
      const token = localStorage.getItem("access_token")
      try {
        const resp = await fetch("/api/custom-rooms/experiments/", {
          headers: { "Authorization": `Bearer ${token}` }
        })
        if (resp.ok) {
          const allExps = await resp.json()
          if (allExps.some(e => e.name.toLowerCase() === expData.name.toLowerCase())) {
            setError("You already have a project with this name.")
            setIsLoading(false)
            return
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    setError("")
    setStep(step + 1)
  }

  const handleCreate = async (addAnother = false) => {
    setIsLoading(true)
    setError("")
    const token = localStorage.getItem("access_token")

    try {
      let activeExpId = experimentId;
      if (!conditionData.name.trim()) {
        setError("Please name this condition");
        setIsLoading(false);
        return;
      }

      // Check for duplicate experiment name (only if this is a brand new project)
      if (!activeExpId && !isEditMode) {
        const allExpResp = await fetch("/api/custom-rooms/experiments/", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (allExpResp.ok) {
          const allExps = await allExpResp.json();
          if (allExps.some(e => e.name.toLowerCase() === expData.name.toLowerCase())) {
            setError("You already have an experiment with this name. Please choose a unique title.");
            setIsLoading(false);
            return;
          }
        }
      }
  
      // Check for duplicate condition name in backend if edit mode
      if (activeExpId) {
        const checkResp = await fetch(`/api/custom-rooms/experiments/${activeExpId}/`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (checkResp.ok) {
          const projectData = await checkResp.json();
          const existingNames = [
            ...(projectData.prisoner_conditions || []),
            ...(projectData.ultimatum_conditions || []),
            ...(projectData.public_goods_conditions || []),
            ...(projectData.common_pool_conditions || [])
          ].map(c => (c.condition_name || "").toLowerCase());
          
          if (existingNames.includes(conditionData.name.toLowerCase()) && !isEditMode) {
            setError("A condition with this name already exists in this project.");
            setIsLoading(false);
            return;
          }
        }
      }

      const finalConditions = [...conditionsList];
      const existingIdx = finalConditions.findIndex(c => c.name.toLowerCase() === conditionData.name.toLowerCase());
      if (existingIdx >= 0) {
        finalConditions[existingIdx] = conditionData;
      } else {
        finalConditions.push(conditionData);
      }
      setConditionsList(finalConditions);

      if (addAnother) {
        const match = conditionData.name.match(/\d+$/);
        const nextNum = match ? parseInt(match[0]) + 1 : finalConditions.length + 1;
        setConditionData({ ...DEFAULT_CONDITION_DATA, name: `Condition ${nextNum}` })
        setIsLoading(false);
        return;
      }

      if (activeExpId) {
        // Save experiment metadata
        await fetch(`/api/custom-rooms/experiments/${activeExpId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(expData),
        });

        // Save conditions
        for (const cond of finalConditions) {
          const params = formatConditionParams(cond, expData.game_type);
          await fetch(`/api/custom-rooms/experiments/${activeExpId}/add_condition/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(params),
          });
        }
        navigate(`/experiments/${activeExpId}`);
      } else {
        setStep(3);
      }

    } catch (err) {
      setError(getErrorMessage(err.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveConsent = async () => {
    setIsLoading(true)
    setError("")
    const token = localStorage.getItem("access_token")
    try {
      if (!consentData.study_title || !consentData.purpose || !consentData.investigator || !consentData.institution || !consentData.contact_email || !consentData.duration_minutes || !consentData.data_collected || !consentData.data_access) {
        throw new Error("Please fill out all required fields (marked with *).")
      }

      if (!consentData.storage_duration) {
        throw new Error("Please specify the storage duration.")
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(consentData.contact_email)) {
        throw new Error("Please enter a valid contact email.")
      }
      
      let activeExpId = experimentId;

      if (!activeExpId) {
        const expResp = await fetch("/api/custom-rooms/experiments/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(expData),
        });
        const expJson = await expResp.json();
        if (!expResp.ok) {
          throw new Error(expJson.name || expJson.detail || "Could not create experiment");
        }
        activeExpId = expJson.id;
        setCreatedCode(expJson.secret_code);
        setExperimentId(activeExpId);
      }

      // Add conditions to backend
      for (const cond of conditionsList) {
        const params = formatConditionParams(cond, expData.game_type);
        const addCondResp = await fetch(`/api/custom-rooms/experiments/${activeExpId}/add_condition/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(params),
        });
        if (!addCondResp.ok) {
          const errJson = await addCondResp.json();
          throw new Error(errJson.detail || "Could not add condition");
        }
      }

      const resp = await fetch(`/api/custom-rooms/experiments/${activeExpId}/save_consent/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(consentData)
      })
      if (!resp.ok) {
        let errorMsg = "Failed to save consent form";
        try {
          const errData = await resp.json();
          const firstKey = Object.keys(errData)[0];
          if (firstKey && Array.isArray(errData[firstKey])) {
            errorMsg = `${firstKey}: ${errData[firstKey][0]}`;
          } else if (errData.error) {
            errorMsg = errData.error;
          } else if (typeof errData === 'string') {
            errorMsg = errData;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }
      
      setExperimentId(activeExpId)

      if (isEditMode || (experimentId && !createdCode)) {
        navigate(`/experiments/${activeExpId}`)
      }
      setStep(4);
    } catch (err) {
      setError(getErrorMessage(err.message))
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 4 && createdCode) {
    return (
      <div className="form-page">
        <div className="success-container">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h2 className="success-title">Experiment Created!</h2>
            <p className="success-desc">
              Your research project is now live in the Laboratory.
            </p>
            <div className="secret-code-bubble">
              <span className="code-label">Private Access Code</span>
              <div className="code-val-row">
                <span className="code-number">{createdCode}</span>
                <button className="copy-code-btn" onClick={() => {
                  navigator.clipboard.writeText(createdCode)
                  alert("Access code copied to clipboard!")
                }}>
                  <Clipboard size={16} />
                  Copy
                </button>
              </div>
            </div>
            <button className="finish-btn" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="form-page">
      <Link to="/dashboard" className="back-link">
        <ArrowLeft size={18} /> Back
      </Link>

      <div className="form-wizard advanced">
        {step === 1 ? (
          <div className="wizard-step">
            <h1 className="step-title">New Experiment</h1>
            
            <div className="input-field">
              <label>Experiment Name <Tooltip text="A unique title for your research project to identify it in the hub." /></label>
              <input type="text" placeholder="" value={expData.name} onChange={e => setExpData({...expData, name: e.target.value})} />
            </div>

            <div className="game-select">
              <label>Game Engine <Tooltip text="The mathematical framework for player interactions (e.g., 2x2 matrix, bargaining, or contribution)." /></label>
              <div className="game-grid">
                <div className={`game-option ${expData.game_type === 'prisoner' ? 'selected' : ''}`} onClick={() => setExpData({...expData, game_type: 'prisoner'})}>
                  <Shield size={24} /> <span>2x2 Game</span>
                </div>
                <div className={`game-option ${expData.game_type === 'ultimatum' ? 'selected' : ''}`} onClick={() => setExpData({...expData, game_type: 'ultimatum'})}>
                  <Coins size={24} /> <span>Ultimatum</span>
                </div>
                <div className={`game-option ${expData.game_type === 'public_goods' ? 'selected' : ''}`} onClick={() => setExpData({...expData, game_type: 'public_goods'})}>
                  <Users size={24} /> <span>Public Goods</span>
                </div>
                <div className={`game-option ${expData.game_type === 'common_pool' ? 'selected' : ''}`} onClick={() => setExpData({...expData, game_type: 'common_pool'})}>
                  <Waves size={24} /> <span>Common Pool</span>
                </div>
              </div>
            </div>

            <button className="next-step-btn" onClick={handleNext} disabled={!expData.name}>
              <span>Next: Set Game Rules</span>
              <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        ) : step === 2 ? (
          <div className="wizard-step">
            <h1 className="step-title">Condition Rules</h1>
            
            <div className="input-field">
              <label>Name <Tooltip text="A label for this specific parameter set." /></label>
              <input type="text" value={conditionData.name} onChange={e => updateCondition({ name: e.target.value })} />
            </div>

            {expData.game_type === 'prisoner' && (
              <div className="pro-params">
                <div className="input-field">
                  <label>Game Type <Tooltip text="Presets for classic 2x2 game variants." /></label>
                  <select 
                    value={conditionData.room_name} 
                    onChange={e => {
                      updateCondition({ room_name: e.target.value });
                      if (e.target.value === "Prisoner's Dilemma") applyPreset('pd');
                      if (e.target.value === "Stag Hunt") applyPreset('stag');
                      if (e.target.value === "Battle of the Sexes (1)") applyPreset('bos1');
                      if (e.target.value === "Battle of the Sexes (2)") applyPreset('bos2');
                    }}
                  >
                    <option value="Prisoner's Dilemma">Prisoner's Dilemma</option>
                    <option value="Stag Hunt">Stag Hunt</option>
                    <option value="Battle of the Sexes (1)">Battle of the Sexes (1)</option>
                    <option value="Battle of the Sexes (2)">Battle of the Sexes (2)</option>
                    <option value="Custom 2x2">Custom Asymmetric Game</option>
                  </select>
                </div>

                <div className="matrix-builder">
                  <h4 className="matrix-title">Matrix Table</h4>
                  <div className="matrix-table">
                    <div className="matrix-cell empty"></div>
                    <div className="matrix-header">Opponent: {
                      conditionData.room_name === "Stag Hunt" ? "Stag" : 
                      conditionData.room_name.includes("Battle") ? "A" : "Cooperate"
                    }</div>
                    <div className="matrix-header">Opponent: {
                      conditionData.room_name === "Stag Hunt" ? "Hare" : 
                      conditionData.room_name.includes("Battle") ? "B" : "Defect"
                    }</div>
                    
                    <div className="matrix-label">You: {
                      conditionData.room_name === "Stag Hunt" ? "Stag" : 
                      conditionData.room_name.includes("Battle") ? "A" : "Cooperate"
                    }</div>
                    <div className="matrix-payoff cc">
                      <input type="number" value={conditionData.p1_cc} onChange={e => updateCondition({p1_cc: parseInt(e.target.value)})} />
                      <span className="slash">/</span>
                      <input type="number" value={conditionData.p2_cc} onChange={e => updateCondition({p2_cc: parseInt(e.target.value)})} />
                    </div>
                    <div className="matrix-payoff cd">
                      <input type="number" value={conditionData.p1_cd} onChange={e => updateCondition({p1_cd: parseInt(e.target.value)})} />
                      <span className="slash">/</span>
                      <input type="number" value={conditionData.p2_cd} onChange={e => updateCondition({p2_cd: parseInt(e.target.value)})} />
                    </div>

                    <div className="matrix-label">You: {
                      conditionData.room_name === "Stag Hunt" ? "Hare" : 
                      conditionData.room_name.includes("Battle") ? "B" : "Defect"
                    }</div>
                    <div className="matrix-payoff dc">
                      <input type="number" value={conditionData.p1_dc} onChange={e => updateCondition({p1_dc: parseInt(e.target.value)})} />
                      <span className="slash">/</span>
                      <input type="number" value={conditionData.p2_dc} onChange={e => updateCondition({p2_dc: parseInt(e.target.value)})} />
                    </div>
                    <div className="matrix-payoff dd">
                      <input type="number" value={conditionData.p1_dd} onChange={e => updateCondition({p1_dd: parseInt(e.target.value)})} />
                      <span className="slash">/</span>
                      <input type="number" value={conditionData.p2_dd} onChange={e => updateCondition({p2_dd: parseInt(e.target.value)})} />
                    </div>
                  </div>
                </div>
                
                <div className="input-field" style={{marginTop: '2rem'}}>
                  <label>Rounds <Tooltip text="How many repeated interactions players will perform in a single match." /></label>
                  <input type="number" value={conditionData.prisoner_rounds} onChange={e => updateCondition({prisoner_rounds: parseInt(e.target.value)})} />
                </div>
              </div>
            )}

            {expData.game_type === 'ultimatum' && (
              <div className="pro-params">
                <div className="param-split">
                  <div className="input-field">
                    <label>Money <Tooltip text="Initial endowment given to the Proposer." /></label>
                    <input type="number" value={conditionData.endowment} onChange={e => updateCondition({ endowment: parseInt(e.target.value) })} />
                  </div>
                  <div className="input-field">
                    <label>Game Type <Tooltip text="Choose Iterative (multiple simultaneous rounds) or One-Shot (single classic round)." /></label>
                    <select 
                      value={conditionData.ultimatum_game_type} 
                      onChange={e => {
                        const newType = e.target.value;
                        const newRounds = newType === "one_shot" ? 1 : conditionData.ultimatum_rounds;
                        updateCondition({ 
                          ultimatum_game_type: newType,
                          ultimatum_rounds: newRounds
                        });
                      }}
                    >
                      <option value="iterative">Iterative</option>
                      <option value="one_shot">One-Shot</option>
                    </select>
                  </div>
                </div>
                <div className="param-split" style={{ marginTop: "1rem" }}>
                  <div className="input-field">
                    <label>Rounds <Tooltip text="Total number of offer-response rounds." /></label>
                    <input 
                      type="number" 
                      value={conditionData.ultimatum_rounds} 
                      onChange={e => updateCondition({ ultimatum_rounds: parseInt(e.target.value) })} 
                      disabled={conditionData.ultimatum_game_type === 'one_shot'}
                    />
                  </div>
                </div>
              </div>
            )}

            {expData.game_type === 'public_goods' && (
              <div className="pro-params">
                <div className="param-split">
                  <div className="input-field">
                    <label>Type <Tooltip text="Defines interaction rules: 'Standard' is contribution only. 'Punishment' allows reducing others' payoffs. 'Reward' allows increasing them. 'Mixed' allows both." /></label>
                    <select value={conditionData.room_type} onChange={e => updateCondition({ room_type: e.target.value })}>
                      <option value="basic">Standard PG</option>
                      <option value="punishment">Punishment</option>
                      <option value="reward">Reward</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label>Money <Tooltip text="Initial endowment given to every player in each round." /></label>
                    <input type="number" value={conditionData.pg_endowment} onChange={e => updateCondition({ pg_endowment: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="input-field">
                  <label>Multiplier <Tooltip text="Factor applied to the total pool before redistributing it equally." /></label>
                  <input type="number" step="0.1" value={conditionData.multiplier} onChange={e => updateCondition({ multiplier: parseFloat(e.target.value) })} />
                </div>
                <div className="input-field">
                  <label>Rounds <Tooltip text="Total contribution-interaction cycles." /></label>
                  <input type="number" value={conditionData.pg_rounds} onChange={e => updateCondition({ pg_rounds: parseInt(e.target.value) })} />
                </div>

                {conditionData.room_type !== 'basic' && (
                  <div className="interaction-params">
                    <h4 className="sub-title">Stage 2 Rules</h4>
                    <div className="matrix-grid">
                      {(conditionData.room_type === 'reward' || conditionData.room_type === 'mixed') && (
                        <>
                          <div className="param-input"><label>Reward Cost <Tooltip text="Amount subtracted from sender's payoff to send a reward." /></label><input type="number" value={conditionData.reward_cost} onChange={e => updateCondition({reward_cost: parseInt(e.target.value)})} /></div>
                          <div className="param-input"><label>Reward Value <Tooltip text="Amount added to recipient's payoff from a reward." /></label><input type="number" value={conditionData.reward_value} onChange={e => updateCondition({reward_value: parseInt(e.target.value)})} /></div>
                        </>
                      )}
                      {(conditionData.room_type === 'punishment' || conditionData.room_type === 'mixed') && (
                        <>
                          <div className="param-input"><label>Punish Cost <Tooltip text="Amount subtracted from sender's payoff to send a punishment." /></label><input type="number" value={conditionData.punishment_cost} onChange={e => updateCondition({punishment_cost: parseInt(e.target.value)})} /></div>
                          <div className="param-input"><label>Punish Value <Tooltip text="Amount subtracted from recipient's payoff from a punishment." /></label><input type="number" value={conditionData.punishment_value} onChange={e => updateCondition({punishment_value: parseInt(e.target.value)})} /></div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {expData.game_type === 'common_pool' && (
              <div className="pro-params">
                <div className="param-split">
                  <div className="input-field">
                    <label>Type <Tooltip text="Defines interaction rules: 'Standard' is harvest only. 'Punishment' allows reducing others' payoffs. 'Reward' allows increasing them. 'Mixed' allows both." /></label>
                    <select value={conditionData.room_type} onChange={e => updateCondition({ room_type: e.target.value })}>
                      <option value="basic">Standard CPR</option>
                      <option value="punishment">Punishment</option>
                      <option value="reward">Reward</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label>Fish Stock <Tooltip text="The initial quantity and maximum capacity of fish in the lake." /></label>
                    <input type="number" value={conditionData.cpr_initial_fish_stock} onChange={e => updateCondition({ cpr_initial_fish_stock: parseInt(e.target.value), cpr_max_fish_stock: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="param-split">
                  <div className="input-field">
                    <label>Max Extraction <Tooltip text="The maximum amount of fish any player can request to harvest in a single round." /></label>
                    <input type="number" value={conditionData.cpr_max_extraction} onChange={e => updateCondition({ cpr_max_extraction: parseInt(e.target.value) })} />
                  </div>
                  <div className="input-field">
                    <label>Bonus Multiplier <Tooltip text="The multiplier applied to remaining fish stock at the end of the game to distribute as a bonus." /></label>
                    <input type="number" step="0.1" value={conditionData.cpr_final_bonus_multiplier} onChange={e => updateCondition({ cpr_final_bonus_multiplier: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div className="param-split">
                  <div className="input-field">
                    <label>Rounds <Tooltip text="Total number of extraction-replenishment rounds." /></label>
                    <input type="number" value={conditionData.cpr_rounds} onChange={e => updateCondition({ cpr_rounds: parseInt(e.target.value) })} />
                  </div>
                  <div className="input-field-empty" style={{flex: 1}}></div>
                </div>

                {conditionData.room_type !== 'basic' && (
                  <div className="interaction-params">
                    <h4 className="sub-title">Stage 2 Rules</h4>
                    <div className="matrix-grid">
                      {(conditionData.room_type === 'reward' || conditionData.room_type === 'mixed') && (
                        <>
                          <div className="param-input"><label>Reward Cost <Tooltip text="Amount subtracted from sender's payoff to send a reward." /></label><input type="number" step="0.1" value={conditionData.cpr_reward_cost} onChange={e => updateCondition({cpr_reward_cost: parseFloat(e.target.value)})} /></div>
                          <div className="param-input"><label>Reward Value <Tooltip text="Amount added to recipient's payoff from a reward." /></label><input type="number" step="0.1" value={conditionData.cpr_reward_value} onChange={e => updateCondition({cpr_reward_value: parseFloat(e.target.value)})} /></div>
                        </>
                      )}
                      {(conditionData.room_type === 'punishment' || conditionData.room_type === 'mixed') && (
                        <>
                          <div className="param-input"><label>Punish Cost <Tooltip text="Amount subtracted from sender's payoff to send a punishment." /></label><input type="number" step="0.1" value={conditionData.cpr_punishment_cost} onChange={e => updateCondition({cpr_punishment_cost: parseFloat(e.target.value)})} /></div>
                          <div className="param-input"><label>Punish Value <Tooltip text="Amount subtracted from recipient's payoff from a punishment." /></label><input type="number" step="0.1" value={conditionData.cpr_punishment_value} onChange={e => updateCondition({cpr_punishment_value: parseFloat(e.target.value)})} /></div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="wizard-actions">
              <button className="secondary-btn" onClick={() => setStep(1)}>Back</button>
              <button className="secondary-btn" onClick={() => handleCreate(true)} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save & Add Another"}
              </button>
              <button className="primary-btn" onClick={() => handleCreate(false)} disabled={isLoading}>
                {isLoading ? "Saving..." : (experimentId ? "Finish & Save" : "Next: Consent Form")}
              </button>
            </div>
          </div>
        ) : null}

        
        {step === 3 && (
          <div className="wizard-step consent-step">
            <h1 className="step-title">Consent Form Builder</h1>
            <p className="step-subtitle">This form will be shown to participants before they can join the experiment.</p>
            
            <h4 className="sub-title">Study Information</h4>
            <div className="input-field">
              <label>Study Title *</label>
              <input type="text" value={consentData.study_title} onChange={e => setConsentData({...consentData, study_title: e.target.value})} />
            </div>
            <div className="input-field">
              <label>Purpose of the study *</label>
              <textarea value={consentData.purpose} onChange={e => setConsentData({...consentData, purpose: e.target.value})} rows="3" placeholder="Briefly describe the purpose..."></textarea>
            </div>
            
            <div className="param-split">
              <div className="input-field">
                <label>Principal Investigator *</label>
                <input type="text" value={consentData.investigator} onChange={e => setConsentData({...consentData, investigator: e.target.value})} />
              </div>
              <div className="input-field">
                <label>Institution / Organization *</label>
                <input type="text" value={consentData.institution} onChange={e => setConsentData({...consentData, institution: e.target.value})} />
              </div>
            </div>
            <div className="input-field">
              <label>Contact Email *</label>
              <input type="email" value={consentData.contact_email} onChange={e => setConsentData({...consentData, contact_email: e.target.value})} />
            </div>
            
            <div className="param-split">
              <div className="input-field">
                <label>Ethics Committee (Optional)</label>
                <input type="text" value={consentData.ethics_committee} onChange={e => setConsentData({...consentData, ethics_committee: e.target.value})} />
              </div>
              <div className="input-field">
                <label>Approval Number (Optional)</label>
                <input type="text" value={consentData.approval_number} onChange={e => setConsentData({...consentData, approval_number: e.target.value})} />
              </div>
            </div>

            <h4 className="sub-title">Participation & Eligibility</h4>
            <div className="param-split">
              <div className="input-field">
                <label>Estimated Duration (minutes) *</label>
                <input type="number" value={consentData.duration_minutes} onChange={e => setConsentData({...consentData, duration_minutes: parseInt(e.target.value)})} />
              </div>
              <div className="input-field">
                <label>Participation Type *</label>
                <select value={consentData.participation_type} onChange={e => setConsentData({...consentData, participation_type: e.target.value})}>
                  <option value="voluntary">Voluntary</option>
                  <option value="mandatory">Mandatory (course req.)</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="input-field checkbox-group">
              <label>Eligibility Criteria</label>
              <div className="eligibility-grid">
                <input type="text" placeholder="Min Age (e.g. 18)" value={consentData.eligibility_criteria.min_age} onChange={e => setConsentData({...consentData, eligibility_criteria: {...consentData.eligibility_criteria, min_age: e.target.value}})} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <select 
                    value={isCustomCountry ? "Specific" : consentData.eligibility_criteria.countries} 
                    onChange={e => {
                      if (e.target.value === "Specific") {
                        setIsCustomCountry(true)
                        setConsentData({...consentData, eligibility_criteria: {...consentData.eligibility_criteria, countries: ""}})
                      } else {
                        setIsCustomCountry(false)
                        setConsentData({...consentData, eligibility_criteria: {...consentData.eligibility_criteria, countries: e.target.value}})
                      }
                    }}
                  >
                    <option value="">Any Country</option>
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="EU">European Union</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="India">India</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Spain">Spain</option>
                    <option value="Italy">Italy</option>
                    <option value="China">China</option>
                    <option value="Japan">Japan</option>
                    <option value="Brazil">Brazil</option>
                    <option value="Specific">Specific...</option>
                  </select>
                  {isCustomCountry && (
                    <input 
                      type="text" 
                      placeholder="Enter country..." 
                      value={consentData.eligibility_criteria.countries} 
                      onChange={e => setConsentData({...consentData, eligibility_criteria: {...consentData.eligibility_criteria, countries: e.target.value}})} 
                    />
                  )}
                </div>
                <input type="text" placeholder="Language (e.g. English)" value={consentData.eligibility_criteria.language} onChange={e => setConsentData({...consentData, eligibility_criteria: {...consentData.eligibility_criteria, language: e.target.value}})} />
                <input type="text" placeholder="Other Requirements" value={consentData.eligibility_criteria.other} onChange={e => setConsentData({...consentData, eligibility_criteria: {...consentData.eligibility_criteria, other: e.target.value}})} />
              </div>
            </div>

            <h4 className="sub-title">Compensation & Risks</h4>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
              <input type="checkbox" id="comp_enabled" checked={consentData.compensation_enabled} onChange={e => setConsentData({...consentData, compensation_enabled: e.target.checked})} />
              <label htmlFor="comp_enabled" style={{marginBottom: 0}}>Include compensation section</label>
            </div>
            
            {consentData.compensation_enabled && (
              <>
                <div className="input-field">
                  <label>Compensation Type</label>
                  <select value={consentData.compensation_type} onChange={e => setConsentData({...consentData, compensation_type: e.target.value})}>
                    <option value="None">None</option>
                    <option value="Fixed payment">Fixed payment</option>
                    <option value="Performance-based">Performance-based payment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="input-field">
                  <label>Description</label>
                  <textarea value={consentData.compensation_description} onChange={e => setConsentData({...consentData, compensation_description: e.target.value})} rows="2"></textarea>
                </div>
              </>
            )}

            <div className="param-split">
              <div className="input-field">
                <label>Risks</label>
                <textarea value={consentData.risks} onChange={e => setConsentData({...consentData, risks: e.target.value})} rows="2" placeholder="Describe any risks..."></textarea>
              </div>
              <div className="input-field">
                <label>Benefits</label>
                <textarea value={consentData.benefits} onChange={e => setConsentData({...consentData, benefits: e.target.value})} rows="2" placeholder="Describe any benefits..."></textarea>
              </div>
            </div>

            <h4 className="sub-title">Data Collection & Storage</h4>
            <div className="input-field">
              <label>What data will be collected? *</label>
              <textarea value={consentData.data_collected} onChange={e => setConsentData({...consentData, data_collected: e.target.value})} rows="2"></textarea>
            </div>
            <div className="input-field">
              <label>Who will have access? *</label>
              <textarea value={consentData.data_access} onChange={e => setConsentData({...consentData, data_access: e.target.value})} rows="2"></textarea>
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
              <input type="checkbox" id="post_survey" checked={consentData.post_experiment_survey} onChange={e => setConsentData({...consentData, post_experiment_survey: e.target.checked})} />
              <label htmlFor="post_survey" style={{marginBottom: 0}}>Include optional demographic questionnaire</label>
            </div>

            <div className="param-split">
              <div className="input-field">
                <label>Storage Duration</label>
                <select 
                  value={isCustomStorage ? "Custom" : consentData.storage_duration} 
                  onChange={e => {
                    if (e.target.value === "Custom") {
                      setIsCustomStorage(true)
                      setConsentData({...consentData, storage_duration: ""})
                    } else {
                      setIsCustomStorage(false)
                      setConsentData({...consentData, storage_duration: e.target.value})
                    }
                  }}
                >
                  <option value="1 year">1 year</option>
                  <option value="5 years">5 years</option>
                  <option value="10 years">10 years</option>
                  <option value="Indefinitely">Indefinitely</option>
                  <option value="Custom">Custom</option>
                </select>
                {isCustomStorage && (
                  <input 
                    type="text" 
                    placeholder="Enter custom duration..." 
                    value={consentData.storage_duration} 
                    onChange={e => setConsentData({...consentData, storage_duration: e.target.value})} 
                    style={{marginTop: "0.5rem"}}
                  />
                )}
              </div>
            </div>

            <h4 className="sub-title">Future Use of Data</h4>
            <div className="checkbox-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem'}}>
              <label><input type="checkbox" checked={consentData.future_use.research} onChange={e => setConsentData({...consentData, future_use: {...consentData.future_use, research: e.target.checked}})} /> Allow future research use</label>
              <label><input type="checkbox" checked={consentData.future_use.collaborators} onChange={e => setConsentData({...consentData, future_use: {...consentData.future_use, collaborators: e.target.checked}})} /> Allow sharing with collaborators</label>
              <label><input type="checkbox" checked={consentData.future_use.public} onChange={e => setConsentData({...consentData, future_use: {...consentData.future_use, public: e.target.checked}})} /> Allow public release (anonymized)</label>
              <label><input type="checkbox" checked={consentData.future_use.educational} onChange={e => setConsentData({...consentData, future_use: {...consentData.future_use, educational: e.target.checked}})} /> Allow educational use</label>
              <label><input type="checkbox" checked={consentData.future_use.commercial} onChange={e => setConsentData({...consentData, future_use: {...consentData.future_use, commercial: e.target.checked}})} /> Allow commercial collaborations</label>
            </div>

            <div className="wizard-actions">
              <button className="secondary-btn" onClick={() => setStep(2)}>Back</button>
              <button className="primary-btn" onClick={handleSaveConsent} disabled={isLoading}>
                {isLoading ? "Saving..." : "Finish & Save"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  )
}

export default ExperimentForm
