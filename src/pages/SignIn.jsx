import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase/config";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { setUser } from "../redux/userSlice";
import { loadCartFromDB, syncCartWithDB } from "../redux/cartSlice"; // Added syncCartWithDB
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { m } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import defaultPfp from "../assets/defaultpfp.png";
import CartPersistence from "../utils/cartPersistence";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState({ google: false, github: false });
  const [recaptchaChecking, setRecaptchaChecking] = useState(false);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const from = location.state?.from?.pathname || "/";

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
      const token = await executeRecaptcha('signin');
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

  /**
   * Handle successful sign-in - update user document and load cart
   */
  const handleSignInSuccess = async (user) => {
    try {
      console.log("🟢 Sign-in successful for user:", user.uid);
      
      // Create or update user document
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // New user - set up with default profile picture
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || "",
          profilePic: user.photoURL || defaultPfp,
          cart: [], // Initialize empty cart
          createdAt: new Date().toISOString(),
          emailVerified: user.emailVerified || true,
          lastLogin: new Date().toISOString(),
        });
        console.log("✅ New user document created");
      } else {
        // Existing user - update last login
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          lastLogin: new Date().toISOString(),
          emailVerified: user.emailVerified || true,
        }, { merge: true });
        console.log("✅ User document updated");
      }

      // Get guest cart from localStorage
      const guestCart = CartPersistence.loadFromLocalStorage();
      console.log("📦 Guest cart found:", guestCart);
      
      if (guestCart.length > 0) {
        // Merge guest cart with user's saved cart
        console.log("🔄 Merging guest cart with user cart...");
        const mergedCart = await CartPersistence.handleUserSignIn(user.uid, guestCart);
        console.log("✅ Merged cart:", mergedCart);
        toast.info("Your guest cart items have been added to your account");
      }

      // Load user's cart from Firestore into Redux
      console.log("📥 Loading cart from Firestore...");
      await dispatch(loadCartFromDB(user.uid));

      // Update Redux user state
      dispatch(setUser({ 
        uid: user.uid, 
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || "",
        emailVerified: user.emailVerified || true,
        photoURL: user.photoURL || null
      }));

      toast.success("Successfully signed in!");
      navigate(from, { replace: true });
    } catch (error) {
      console.error("❌ Error in post-sign-in handling:", error);
      toast.error("Signed in but failed to load your data. Please refresh the page.");
      // Still navigate even if cart loading fails
      navigate(from, { replace: true });
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    if (!await verifyRecaptchaToken()) {
      return;
    }

    setLoading(true);

    try {
      // Sign in with email and password
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Check if email is verified
      if (!user.emailVerified) {
        // Send verification email
        await sendEmailVerification(user);
        setVerificationSent(true);
        toast.info("Please verify your email before signing in. A new verification email has been sent.");
        setLoading(false);
        return;
      }

      // Handle successful sign-in
      await handleSignInSuccess(user);

    } catch (error) {
      console.error("Error signing in:", error);
      
      // Handle specific error cases
      switch (error.code) {
        case 'auth/user-not-found':
          toast.error("No account found with this email. Please sign up first.");
          break;
        case 'auth/wrong-password':
          toast.error("Incorrect password. Please try again.");
          break;
        case 'auth/invalid-email':
          toast.error("Invalid email address format.");
          break;
        case 'auth/user-disabled':
          toast.error("This account has been disabled. Please contact support.");
          break;
        case 'auth/too-many-requests':
          toast.error("Too many failed attempts. Please try again later.");
          break;
        default:
          toast.error(error.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (e, providerType) => {
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

      // Handle successful sign-in (social sign-ins are automatically verified)
      await handleSignInSuccess(user);

    } catch (error) {
      console.error("Error with social sign in:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error("Sign-in popup was closed. Please try again.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore - this is usually just a duplicate request
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error("An account already exists with the same email using a different sign-in method.");
      } else {
        toast.error(error.message || "An error occurred during sign in.");
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
      toast.error("Please sign in first to resend verification email");
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser);
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error) {
      console.error("Error sending verification email:", error);
      toast.error("Failed to send verification email. Please try again.");
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your aediax account</p>
        </div>

        {/* Main Card */}
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
        >
          {!verificationSent ? (
            <>
              {/* Email/Password Sign In Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-6">
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
                      placeholder="Enter your password"
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
                </div>

                <div className="flex items-center justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading || recaptchaChecking || !email || !password}
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading || recaptchaChecking ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
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
                  <span className="px-4 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Social Sign In */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={(e) => handleSocialSignIn(e, 'google')}
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
                  onClick={(e) => handleSocialSignIn(e, 'github')}
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
                A verification email has been sent to <span className="font-medium text-gray-900">{email}</span>
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 mb-3">
                  Please check your email and click the verification link to activate your account.
                </p>
                <button
                  onClick={resendVerificationEmail}
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  Resend verification email
                </button>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setVerificationSent(false)}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium block w-full"
                >
                  Try signing in again
                </button>
                <Link
                  to="/signup"
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium block w-full"
                >
                  Create a new account
                </Link>
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
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-gray-900 hover:text-gray-700 transition-colors">
            Sign up
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

export default SignIn;