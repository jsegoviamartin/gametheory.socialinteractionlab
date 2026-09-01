import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { User, Lock, Mail, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from "lucide-react"
import { getErrorMessage } from "./utils/errorUtils"
import "./AuthPage.css"

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [otpToken, setOtpToken] = useState("")
  
  const [setupRequired, setSetupRequired] = useState(false)
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError("")
  }

  const handleOtpChange = (e) => {
    setOtpToken(e.target.value)
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (!isLogin && formData.password !== formData.passwordConfirm) {
      setError("Passwords do not match.")
      setIsLoading(false)
      return
    }

    const endpoint = isLogin ? "/api/accounts/login/" : "/api/accounts/register/"
    const body = isLogin 
      ? { 
          username: formData.username, 
          password: formData.password,
          otp_token: otpToken 
        }
      : { username: formData.username, email: formData.email, password: formData.password }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ""}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })

      const data = await response.json()

      if (response.ok) {
        if (isLogin) {
          if (data.mfa_required) {
            setMfaRequired(true)
            setIsLoading(false)
            return
          }

          localStorage.setItem("access_token", data.access)
          localStorage.setItem("refresh_token", data.refresh)
          
          if (data.mfa_setup_required) {
            setSetupRequired(true)
            setIsLoading(false)
            return
          }
          navigate("/dashboard")
        } else {
          setSuccess(true)
          setTimeout(() => {
            setIsLogin(true)
            setSuccess(false)
          }, 2000)
        }
      } else {
        setError(getErrorMessage(data))
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} /> Back to Portal
      </Link>

      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">
            {mfaRequired ? "Security Verification" : (isLogin ? "Welcome Back" : "Create Account")}
          </h1>
          <p className="auth-subtitle">
            {mfaRequired 
              ? "Enter the 6-digit code from your authenticator app"
              : (isLogin 
                ? "Login to manage your customized game rooms" 
                : "Register as a creator to start building experiments")}
          </p>
        </div>

        {setupRequired ? (
          <div className="setup-required-state" style={{ textAlign: 'center', padding: '1rem' }}>
            <ShieldCheck size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
            <h2 className="auth-title">Two-Factor Required</h2>
            <p className="auth-subtitle">To keep your account secure, you must enable Two-Factor Authentication before accessing the dashboard.</p>
            <button 
              onClick={() => window.location.href = "/account/two_factor/setup/"} 
              className="auth-button"
              style={{ marginTop: '1.5rem' }}
            >
              Setup 2FA Now
            </button>
          </div>
        ) : success ? (
          <div className="success-state">
            <CheckCircle2 size={48} color="#10b981" />
            <p>Account created successfully! Switching to login...</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {!mfaRequired ? (
              <>
                <div className="input-group">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>

                {!isLogin && (
                  <div className="input-group">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleChange}
                      required={!isLogin}
                    />
                  </div>
                )}

                <div className="input-group">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                {!isLogin && (
                  <div className="input-group">
                    <Lock className="input-icon" size={18} />
                    <input
                      type="password"
                      name="passwordConfirm"
                      placeholder="Confirm Password"
                      value={formData.passwordConfirm}
                      onChange={handleChange}
                      required={!isLogin}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="input-group">
                <ShieldCheck className="input-icon" size={18} />
                <input
                  type="text"
                  name="otp_token"
                  placeholder="6-digit code"
                  value={otpToken}
                  onChange={handleOtpChange}
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : (mfaRequired ? "Verify Code" : (isLogin ? "Log In" : "Sign Up"))}
            </button>

            {mfaRequired && (
              <button 
                type="button" 
                onClick={() => setMfaRequired(false)} 
                className="toggle-auth"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                Back to Login
              </button>
            )}
          </form>
        )}

        {!mfaRequired && (
          <div className="auth-footer">
            {isLogin && (
              <div style={{ marginBottom: "1rem" }}>
                <Link to="/forgot-password" style={{ color: "#3b82f6", textDecoration: "none", fontSize: "0.9rem" }}>
                  Forgot Password?
                </Link>
              </div>
            )}
            <button onClick={() => setIsLogin(!isLogin)} className="toggle-auth">
              {isLogin ? "Need an account? Sign Up" : "Already have an account? Log In"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthPage
