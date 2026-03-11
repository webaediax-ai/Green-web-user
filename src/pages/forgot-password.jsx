import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { m } from "framer-motion";
import { Mail, ArrowRight, Loader2, CheckCircle2, KeyRound, AlertCircle } from "lucide-react";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [recaptchaChecking, setRecaptchaChecking] = useState(false);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [error, setError] = useState("");

  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();

  const verifyRecaptchaToken = async () => {
    if (captchaUnavailable) {
      console.warn("reCAPTCHA verification bypassed due to unavailability");
      return true;
    }

    if (!executeRecaptcha) {
      console.warn("reCAPTCHA not available, proceeding without verification");
      setCaptchaUnavailable(true);
      return true;
    }

    setRecaptchaChecking(true);
    try {
      const token = await executeRecaptcha('forgot_password');
      console.log("reCAPTCHA token:", token);
      return !!token;
    } catch (error) {
      console.error("reCAPTCHA error:", error);
      toast.error("Could not verify you are human. Proceeding anyway.");
      setCaptchaUnavailable(true);
      return true;
    } finally {
      setRecaptchaChecking(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      toast.error("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      toast.error("Please enter a valid email address");
      return;
    }

    if (!await verifyRecaptchaToken()) {
      return;
    }

    setLoading(true);

    try {
      // Configure action code settings
      const actionCodeSettings = {
        url: window.location.origin + '/signin',
        handleCodeInApp: false, // Password reset should open in browser
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      setEmailSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      console.error("Error sending password reset email:", error);
      
      // Handle specific error cases
      switch (error.code) {
        case 'auth/user-not-found':
          setError("No account found with this email address");
          toast.error("No account found with this email address");
          break;
        case 'auth/invalid-email':
          setError("Invalid email address format");
          toast.error("Invalid email address format");
          break;
        case 'auth/too-many-requests':
          setError("Too many requests. Please try again later.");
          toast.error("Too many requests. Please try again later.");
          break;
        default:
          setError(error.message || "Failed to send reset email");
          toast.error(error.message || "Failed to send reset email");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Reset email resent! Please check your inbox.");
    } catch (error) {
      console.error("Error resending email:", error);
      toast.error("Failed to resend email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let captchaTimeout;

    if (!executeRecaptcha) {
      console.log("reCAPTCHA not yet available");
      captchaTimeout = setTimeout(() => {
        console.warn("reCAPTCHA failed to load after timeout, bypassing verification");
        setCaptchaUnavailable(true);
      }, 5000);
    }

    return () => {
      if (captchaTimeout) clearTimeout(captchaTimeout);
    };
  }, [executeRecaptcha]);

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
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
          <p className="text-gray-600">No worries, we'll send you reset instructions</p>
        </div>

        {/* Main Card */}
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
        >
          {!emailSent ? (
            <>
              {/* Reset Password Form */}
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@example.com"
                      className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 placeholder-gray-400 ${
                        error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      required
                      disabled={loading || recaptchaChecking}
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {error}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    We'll send a password reset link to this email address
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || recaptchaChecking || !email}
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading || recaptchaChecking ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Instructions
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Back to Sign In */}
              <div className="mt-6 text-center">
                <Link
                  to="/signin"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center"
                >
                  <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
                  Back to sign in
                </Link>
              </div>

              {/* Security Note */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>🔒 Security Note:</strong> For your security, password reset links expire after 1 hour. 
                  If you don't receive an email, check your spam folder or try again.
                </p>
              </div>
            </>
          ) : (
            /* Email Sent Success State */
            <div className="text-center py-6">
              <m.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4"
              >
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </m.div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h3>
              <p className="text-gray-600 mb-4">
                We've sent a password reset link to:
              </p>
              <p className="font-medium text-gray-900 bg-gray-50 py-2 px-4 rounded-lg mb-6">
                {email}
              </p>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-2">
                    <strong>📧 Can't find the email?</strong>
                  </p>
                  <p className="text-xs text-yellow-700 mb-3">
                    Check your spam folder or wait a few minutes. The email might be delayed.
                  </p>
                  <button
                    onClick={handleResendEmail}
                    disabled={loading}
                    className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Sending..." : "Resend email"}
                  </button>
                </div>

                <div className="pt-4 space-y-2">
                  <Link
                    to="/signin"
                    className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Return to sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Don't have an account? Sign up
                  </Link>
                </div>
              </div>

              {/* Reset Instructions */}
              <div className="mt-6 text-left bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">What happens next?</h4>
                <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                  <li>Click the link in the email we sent you</li>
                  <li>You'll be taken to a secure page to create a new password</li>
                  <li>Choose a strong password you haven't used before</li>
                  <li>Sign in with your new password</li>
                </ol>
              </div>
            </div>
          )}

          {/* reCAPTCHA Notice */}
          {captchaUnavailable && (
            <p className="mt-4 text-xs text-center text-gray-500">
              reCAPTCHA verification bypassed due to unavailability.
            </p>
          )}
        </m.div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help?{" "}
            <a href="/contact" className="font-medium text-gray-900 hover:text-gray-700 transition-colors">
              Contact Support
            </a>
          </p>
        </div>

        {/* Privacy Notice */}
        <p className="mt-4 text-xs text-center text-gray-500">
          Protected by reCAPTCHA and subject to the aediax{" "}
          <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
        </p>
      </div>
    </m.div>
  );
}

export default ForgotPassword;