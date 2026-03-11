import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { m } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, UserPlus, Eye, EyeOff } from "lucide-react";
import defaultPfp from "../assets/defaultpfp.png";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState({ google: false, github: false });
  const [recaptchaChecking, setRecaptchaChecking] = useState(false);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    minLength: false
  });

  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const from = location.state?.from?.pathname || "/";

  // Password strength checker
  useEffect(() => {
    const strength = {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      minLength: password.length >= 8
    };

    const score = Object.values(strength).filter(Boolean).length;
    setPasswordStrength({ ...strength, score });
  }, [password]);

  const getPasswordStrengthText = () => {
    if (password.length === 0) return "";
    if (passwordStrength.score <= 2) return "Weak password";
    if (passwordStrength.score === 3) return "Medium password";
    if (passwordStrength.score >= 4) return "Strong password";
  };

  const getPasswordStrengthColor = () => {
    if (password.length === 0) return "bg-gray-200";
    if (passwordStrength.score <= 2) return "bg-red-500";
    if (passwordStrength.score === 3) return "bg-yellow-500";
    return "bg-green-500";
  };

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
      const token = await executeRecaptcha('signup');
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

  const handleEmailSignUp = async (e) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordStrength.score < 3) {
      toast.error("Please use a stronger password");
      return;
    }

    if (!await verifyRecaptchaToken()) {
      return;
    }

    setLoading(true);

    try {
      // Create user with email and password
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Send email verification
      await sendEmailVerification(user);

      // Create user document with default profile picture
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name: user.email?.split('@')[0] || "",
        profilePic: defaultPfp,
        cart: [],
        createdAt: new Date().toISOString(),
        emailVerified: false,
      });

      setEmailSent(true);
      toast.info("Verification email sent! Please check your inbox.");
      
      // Don't dispatch user yet - wait for email verification
      // Don't navigate - user needs to verify email first
    } catch (error) {
      console.error("Error signing up:", error);
      
      // Handle specific error cases
      switch (error.code) {
        case 'auth/email-already-in-use':
          toast.error("This email is already registered. Please sign in instead.");
          break;
        case 'auth/invalid-email':
          toast.error("Invalid email address format.");
          break;
        case 'auth/weak-password':
          toast.error("Password is too weak. Please use a stronger password.");
          break;
        default:
          toast.error(error.message || "Failed to sign up. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignUp = async (e, providerType) => {
    e.preventDefault();
    e.stopPropagation();

    if (!await verifyRecaptchaToken()) {
      return;
    }

    setSocialLoading({
      ...socialLoading,
      [providerType]: true
    });

    const provider = providerType === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // New user - set default profile picture
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || '',
          profilePic: user.photoURL || defaultPfp,
          cart: [],
          createdAt: new Date().toISOString(),
          emailVerified: true, // Social sign-ins are automatically verified
        });
        toast.success("Welcome to aediax!");
      } else {
        // Existing user
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || userDoc.data().name,
          profilePic: user.photoURL || userDoc.data().profilePic || defaultPfp,
          emailVerified: true,
          lastLogin: new Date().toISOString(),
        }, { merge: true });
        toast.success("Welcome back!");
      }

      dispatch(setUser({ 
        ...user, 
        emailVerified: true 
      }));
      
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Error with social sign up:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error("Sign-up popup was closed. Please try again.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore - this is usually just a duplicate request
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error("An account already exists with the same email using a different sign-in method.");
      } else {
        toast.error(error.message || "An error occurred during sign up.");
      }
    } finally {
      setSocialLoading({
        ...socialLoading,
        [providerType]: false
      });
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      toast.error("Unable to resend verification email. Please try signing up again.");
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser);
      toast.success("Verification email resent! Please check your inbox.");
    } catch (error) {
      console.error("Error sending verification email:", error);
      toast.error("Failed to resend verification email. Please try again.");
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
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join aediax and discover premium stationery</p>
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
              {/* Email/Password Sign Up Form */}
              <form onSubmit={handleEmailSignUp} className="space-y-6">
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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 placeholder-gray-400"
                      required
                      disabled={loading || recaptchaChecking}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 placeholder-gray-400"
                      required
                      disabled={loading || recaptchaChecking}
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
                  {password && (
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
                    Confirm Password
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
                      placeholder="Confirm your password"
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 placeholder-gray-400"
                      required
                      disabled={loading || recaptchaChecking}
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
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || recaptchaChecking || !email || !password || !confirmPassword || password !== confirmPassword}
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading || recaptchaChecking ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">Or sign up with</span>
                </div>
              </div>

              {/* Social Sign Up */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={(e) => handleSocialSignUp(e, 'google')}
                  disabled={socialLoading.google || recaptchaChecking}
                  className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {socialLoading.google ? (
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  ) : (
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {socialLoading.google ? "Processing..." : "Continue with Google"}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleSocialSignUp(e, 'github')}
                  disabled={socialLoading.github || recaptchaChecking}
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {socialLoading.github ? (
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
                    </svg>
                  )}
                  {socialLoading.github ? "Processing..." : "Continue with GitHub"}
                </button>
              </div>

              {/* Terms Notice */}
              <p className="mt-6 text-xs text-center text-gray-500">
                By signing up, you agree to our{" "}
                <a href="/terms" className="underline hover:text-gray-700">Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
              </p>
            </>
          ) : (
            /* Email Verification Required State */
            <div className="text-center py-8">
              <m.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4"
              >
                <Mail className="w-8 h-8 text-yellow-600" />
              </m.div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Verify Your Email</h3>
              <p className="text-gray-600 mb-6">
                We've sent a verification email to <span className="font-medium text-gray-900">{email}</span>
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 mb-3">
                  Please check your email and click the verification link to activate your account.
                </p>
                <p className="text-xs text-yellow-700 mb-3">
                  You won't be able to sign in until your email is verified.
                </p>
                <button
                  onClick={resendVerificationEmail}
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  Resend verification email
                </button>
              </div>
              <div className="space-y-2">
                <Link
                  to="/signin"
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium block"
                >
                  Go to sign in
                </Link>
                <button
                  onClick={() => setEmailSent(false)}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium block w-full"
                >
                  Use a different email
                </button>
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

        {/* Footer */}
        <p className="mt-6 text-center text-gray-600">
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-gray-900 hover:text-gray-700 transition-colors">
            Sign in
          </Link>
        </p>

        {/* Privacy Notice */}
        <p className="mt-4 text-xs text-center text-gray-500">
          Protected by reCAPTCHA and subject to the aediax{" "}
          <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
        </p>
      </div>
    </m.div>
  );
}

export default SignUp;