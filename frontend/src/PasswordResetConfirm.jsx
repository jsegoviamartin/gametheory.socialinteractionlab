import React, { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Lock, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { getErrorMessage } from "./utils/errorUtils"
import "./AuthPage.css"

function PasswordResetConfirm() {
  const { uidb64, token } = useParams()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    password: "",
    passwordConfirm: "",
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.passwordConfirm) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/auth/password/reset/confirm/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uidb64,
          token: token,
          new_password1: formData.password,
          new_password2: formData.passwordConfirm,
        }),
        credentials: "include",
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          navigate("/auth")
        }, 3000)
      } else {
        const data = await response.json()
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
      <Link to="/auth" className="back-link">
        <ArrowLeft size={18} /> Back to Login
      </Link>

      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Set New Password</h1>
          <p className="auth-subtitle">
            Please enter your new password below.
          </p>
        </div>

        {success ? (
          <div className="success-state" style={{ textAlign: "center", padding: "2rem 0" }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: "0 auto 1rem" }} />
            <p>Password successfully reset! Redirecting to login...</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                placeholder="New Password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value })
                  setError("")
                }}
                required
              />
            </div>

            <div className="input-group">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={formData.passwordConfirm}
                onChange={(e) => {
                  setFormData({ ...formData, passwordConfirm: e.target.value })
                  setError("")
                }}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default PasswordResetConfirm
