import React, { useState } from "react"
import { Link } from "react-router-dom"
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { getErrorMessage } from "./utils/errorUtils"
import "./AuthPage.css"

function PasswordResetRequest() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/auth/password/reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      })

      if (response.ok) {
        setSuccess(true)
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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="success-state" style={{ textAlign: "center", padding: "2rem 0" }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: "0 auto 1rem" }} />
            <p>If an account exists with that email, a password reset link has been sent.</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError("")
                }}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default PasswordResetRequest
