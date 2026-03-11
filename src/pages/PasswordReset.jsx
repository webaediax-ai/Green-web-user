import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { m } from "framer-motion";
import { Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    minLength: false
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Get the reset code from URL
  const getResetCode = () => {
    const params = new URLSearchParams(location.search);
    return params.get('oobCode');
  };

  // Verify the reset code on component mount
  useEffect(() => {
    const verifyCode = async () => {
      const resetCode = getResetCode();
      
      if (!resetCode) {
        setError("Invalid or missing reset code");
        setVerifying(false);
        return;
      }

      try {
        const email = await verifyPasswordResetCode(auth, resetCode);
        setEmail(email);
        setError("");
      } catch (error) {
        console.error("Error verifying reset code:", error);
        if (error.code === 'auth/expired-action-code') {
          setError("This password reset link has expired. Please request a new one.");
        } else if (error.code === 'auth/invalid-action-code') {
          setError("This password reset link is invalid. Please request a new one.");
        } else {
          setError("Failed to verify reset code. Please try again.");
        }
      } finally {
        setVerifying(false);
      }
    };

    verifyCode();
  }, [location]);

  // Password strength checker
  useEffect(() => {
    const strength = {
      hasUpperCase: /[A-Z]/.test(newPassword),
      hasLowerCase: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
      minLength: newPassword.length >= 8
    };

    const score = Object.values(strength).filter(Boolean).length;
    setPasswordStrength({ ...strength, score });
  }, [newPassword]);

  const getPasswordStrengthText = () => {
    if (newPassword.length === 0) return "";
    if (passwordStrength.score <= 2) return "Weak password";
    if (passwordStrength.score === 3) return "Medium password";
    if (passwordStrength.score >= 4) return "Strong password";
  };

  const getPasswordStrengthColor = () => {
    if (newPassword.length === 0) return "bg-gray-200";
    if (passwordStrength.score <= 2) return "bg-red-500";
    if (passwordStrength.score === 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    if (passwordStrength.score < 3) {
      setError("Please use a stronger password");
      toast.error("Please use a stronger password");
      return;
    }

    const resetCode = getResetCode();
    if (!resetCode) {
      setError("Invalid reset code");
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, resetCode, newPassword);
      setResetComplete(true);
      toast.success("Password reset successful! You can now sign in with your new password.");
    } catch (error) {
      console.error("Error resetting password:", error);
      
      switch (error.code) {
        case 'auth/expired-action-code':
          setError("This password reset link has expired. Please request a new one.");
          toast.error("Reset link expired");
          break;
        case 'auth/invalid-action-code':
          setError("This password reset link is invalid. Please request a new one.");
          toast.error("Invalid reset link");
          break;
        case 'auth/weak-password':
          setError("Password is too weak. Please choose a stronger password.");
          toast.error("Weak password");
          break;
        default:
          setError(error.message || "Failed to reset password. Please try again.");
          toast.error(error.message || "Failed to reset password");
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (error && !resetComplete) {
    return (
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4"
      >
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Request New Reset Link
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </m.div>
    );
  }

  if (resetComplete) {
    return (
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4"
      >
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <m.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </m.div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Password Reset Complete!</h2>
            <p className="text-gray-600 mb-6">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Go to Sign In
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">Choose a new password for {email}</p>
        </div>

        {/* Main Card */}
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
        >
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 placeholder-gray-400"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              
              {/* Password strength indicator */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex space-x-1 flex-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                            i < passwordStrength.score ? getPasswordStrengthColor() : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1 mt-2">
                    <li className={passwordStrength.minLength ? "text-green-600" : ""}>
                      • At least 8 characters
                    </li>
                    <li className={passwordStrength.hasUpperCase ? "text-green-600" : ""}>
                      • At least one uppercase letter
                    </li>
                    <li className={passwordStrength.hasLowerCase ? "text-green-600" : ""}>
                      • At least one lowercase letter
                    </li>
                    <li className={passwordStrength.hasNumber ? "text-green-600" : ""}>
                      • At least one number
                    </li>
                    <li className={passwordStrength.hasSpecialChar ? "text-green-600" : ""}>
                      • At least one special character
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 placeholder-gray-400"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Resetting...
                </>
              ) : (
                <>
                  Reset Password
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/signin"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </m.div>
      </div>
    </m.div>
  );
}

export default ResetPassword;