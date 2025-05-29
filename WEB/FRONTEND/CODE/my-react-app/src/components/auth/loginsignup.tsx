import { useState, useEffect } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, UserIcon, CheckCircleIcon, Share2, Moon, Sun } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { CreateUserSchema, LoginUserSchema } from '../auth/authzod'; // Import the Zod schemas
import { jwtDecode, JwtPayload as BaseJwtPayload } from "jwt-decode"; // Renamed to avoid conflict

interface DecodedJwtPayload extends BaseJwtPayload {
  userId?: string;
}

interface AuthPageProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function AuthPage({ darkMode, setDarkMode }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formSuccess, setFormSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [particles, setParticles] = useState(Array(15).fill(null).map(() => ({
    size: Math.random() * 4 + 1,
    x: Math.random() * 100,
    y: Math.random() * 100,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3
  })));

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length > 6) strength += 1;
    if (password.length > 10) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    setPasswordStrength(strength);
  }, [password]);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(particles =>
        particles.map(particle => ({
          ...particle,
          x: ((particle.x + particle.speedX + 100) % 100),
          y: ((particle.y + particle.speedY + 100) % 100)
        }))
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const validateCreateUser = (data: any) => {
    try {
      CreateUserSchema.parse(data);
      return { valid: true, data };
    } catch (e: any) {
      return { valid: false, errors: e.errors };
    }
  };

  const validateLoginUser = (data: any) => {
    try {
      LoginUserSchema.parse(data);
      return { valid: true, data };
    } catch (e: any) {
      return { valid: false, errors: e.errors };
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const formData = isLogin ? { email, password } : { username, email, password };

    // Validate the data
    const validationResult = isLogin ? validateLoginUser(formData) : validateCreateUser(formData);
    if (!validationResult.valid) {
      setErrorMessage(validationResult.errors.map((error: any) => error.message).join(', '));
      setIsLoading(false);
      return;
    }

    try {
      const backendBaseUrl = 'http://localhost:5000';
      const endpoint = isLogin ? 'signin' : 'signup';
      const url = `${backendBaseUrl}/v1/api/${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          //'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(formData),
      });
      const responseData = await response.json();

      if (responseData.status === "success") {
        const token = response.headers.get('Authorization') || responseData.token;
        if (token) {
          localStorage.setItem('authToken', token.replace('Bearer ', ''));
        }

        setSuccessMessage(responseData.message || (isLogin ? "Login successful!" : "Account created successfully!"));
        setFormSuccess(true);

        setTimeout(async () => {
          setFormSuccess(false);
          if (isLogin) {
            try {
              const storedToken = localStorage.getItem('authToken');
              if (!storedToken) throw new Error("No token found");

              const decoded = jwtDecode<DecodedJwtPayload>(storedToken);
              const userResponse = await fetch(`http://localhost:5000/v1/api/users/${decoded.userId}`, {
                headers: { 'Authorization': `Bearer ${storedToken}` }
              });

              const userData = await userResponse.json();

              if (userData.data.twoFactorEnabled) {
                navigate('/verify-2fa');
              } else {
                // Redirect to admin interface if user is admin
                if (userData.data.is_admin) {
                  navigate('/admin');
                } else {
                  navigate('/dashboard');
                }
              }
            } catch (error) {
              console.error("User check failed:", error);
              navigate('/dashboard');
            }
          } else {
            setUsername('');
            setEmail('');
            setPassword('');
            setIsLogin(true);
          }
        }, 1500);
      } else {
        if (responseData.status === "warning" || responseData.status === "failed") {
          setErrorMessage(responseData.message || "An error occurred");
        }
      }
    } catch (error: any) {
      let errorMsg = error.message;
      if (error.message.includes('Failed to fetch')) {
        errorMsg = `Cannot connect to backend server. Please ensure:
        1. Backend is running on port 5000
        2. No firewall is blocking the connection
        3. You have internet connectivity`;
      }
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setErrorMessage("");
    setSuccessMessage("");
    const form = document.getElementById("auth-form");
    if (form) {
      form.classList.add("translate-x-full", "opacity-0");
    }
    setTimeout(() => {
      setIsLogin(!isLogin);
      setPassword("");
      setPasswordStrength(0);
    }, 300);
  };

  useEffect(() => {
    const form = document.getElementById("auth-form");
    if (form) {
      setTimeout(() => {
        form.classList.remove("translate-x-full", "opacity-0");
        form.classList.add("translate-x-0", "opacity-100");
      }, 50);
    }
  }, [isLogin]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`flex min-h-screen w-full flex-col items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} px-4 py-12 overflow-hidden transition-colors duration-500 relative`}>
      {particles.map((particle, index) => (
        <div
          key={index}
          className={`absolute rounded-full ${darkMode ? 'bg-violet-500/20' : 'bg-cyan-500/20'} blur-sm`}
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transition: 'left 1s linear, top 1s linear'
          }}
        />
      ))}

      <div className="fixed top-4 left-0 right-0 flex justify-center z-50">
        <div className="w-full max-w-md px-4">
          {errorMessage && (
            <div className={`p-4 mb-4 rounded-lg ${darkMode ? 'bg-red-800/90 text-red-100' : 'bg-red-100 text-red-800'} shadow-lg transition-all duration-300 animate-fade-in`}>
              <div className="font-bold">{errorMessage.includes('Cannot connect') ? 'Connection Error' : 'Authentication Error'}</div>
              <div>{errorMessage}</div>
              {errorMessage.includes('Cannot connect') && (
                <div className="mt-2 text-sm">
                  <p>Troubleshooting steps:</p>
                  <ol className="list-decimal pl-5">
                    <li>Check if backend server is running</li>
                    <li>Verify no firewall is blocking port 5000</li>
                    <li>Try refreshing the page</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className={`p-4 mb-4 rounded-lg ${darkMode ? 'bg-emerald-800/90 text-emerald-100' : 'bg-emerald-100 text-emerald-800'} shadow-lg transition-all duration-300 animate-fade-in`}>
              <div className="font-bold">Success</div>
              <div>{successMessage}</div>
            </div>
          )}
        </div>
      </div>

      <div className={`relative w-full max-w-md overflow-hidden rounded-xl ${darkMode ? 'bg-gray-800/60 shadow-xl shadow-violet-900/10' : 'bg-white/70 shadow-lg shadow-cyan-100'} backdrop-blur-lg p-8 transition-all duration-500 border ${darkMode ? 'border-gray-700/50' : 'border-gray-200'} mt-16`}>
        {formSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gray-900/90 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className={`rounded-full p-3 mb-4 animate-bounce ${darkMode ? 'bg-violet-600' : 'bg-emerald-500'}`}>
              <CheckCircleIcon className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {isLogin ? "Welcome back!" : "Account created!"}
            </h3>
            <p className="text-gray-300">
              {isLogin ? "Successfully logged in" : "Your account has been created successfully"}
            </p>
          </div>
        )}

        <button
          onClick={toggleDarkMode}
          className={`absolute top-4 right-4 p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-blue-100 text-blue-600'} transition-all duration-300 hover:scale-110`}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="mb-8 flex flex-col items-center">
          <div className={`flex items-center justify-center h-16 w-16 rounded-full ${darkMode ? 'bg-violet-600' : 'bg-cyan-600'} mb-4 group hover:scale-110 transition-all duration-300 hover:rotate-12`}>
            <Share2 className="h-8 w-8 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500' : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-teal-400'}`}>ShareCode</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your code, your way</p>
        </div>

        <div
          id="auth-form"
          className="transition-all duration-500 ease-in-out transform translate-x-0 opacity-100"
        >
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} mb-6 text-center`}>
            {isLogin ? "Welcome back" : "Join us today"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <UserIcon className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'} group-focus-within:text-violet-500 transition-colors duration-200`} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full rounded-lg ${darkMode ? 'border-gray-700 bg-gray-800/60 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-violet-500' : 'border-gray-300 bg-white/60 text-gray-900 placeholder-gray-400 focus:border-cyan-500 focus:ring-cyan-500'} pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 transition-all duration-200`}
                    placeholder="johndoe"
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="^[a-zA-Z0-9_]+$"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MailIcon className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'} group-focus-within:${darkMode ? 'text-violet-500' : 'text-cyan-500'} transition-colors duration-200`} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-lg ${darkMode ? 'border-gray-700 bg-gray-800/60 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-violet-500' : 'border-gray-300 bg-white/60 text-gray-900 placeholder-gray-400 focus:border-cyan-500 focus:ring-cyan-500'} pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 transition-all duration-200`}
                  placeholder="you@example.com"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <LockIcon className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'} group-focus-within:${darkMode ? 'text-violet-500' : 'text-cyan-500'} transition-colors duration-200`} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-lg ${darkMode ? 'border-gray-700 bg-gray-800/60 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-violet-500' : 'border-gray-300 bg-white/60 text-gray-900 placeholder-gray-400 focus:border-cyan-500 focus:ring-cyan-500'} pl-10 pr-10 py-2.5 focus:outline-none focus:ring-1 transition-all duration-200`}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  maxLength={64}
                />
                <button
                  type="button"
                  className={`absolute right-3 top-3 ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'} transition-colors`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {!isLogin && password && (
                <div className="mt-2">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                    <div
                      className={`transition-all duration-300 ${
                        passwordStrength < 2 ? 'bg-red-500' :
                        passwordStrength < 4 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs mt-1 text-gray-400">
                    {passwordStrength < 2 ? 'Weak password' :
                     passwordStrength < 4 ? 'Medium password' : 'Strong password'}
                  </p>
                </div>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <input
                    id="remember"
                    type="checkbox"
                    className={`h-4 w-4 rounded ${darkMode ? 'border-gray-700 bg-gray-800 text-violet-600 focus:ring-violet-500' : 'border-gray-300 bg-white text-cyan-600 focus:ring-cyan-500'}`}
                  />
                  <label htmlFor="remember" className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Remember me
                  </label>
                </div>
                <Link
                  to="/request-reset-password"
                  className={`${darkMode ? 'text-violet-400 hover:text-violet-300' : 'text-cyan-600 hover:text-cyan-700'} transition-colors`}
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full rounded-lg ${darkMode ? 'bg-violet-600 hover:bg-violet-500 focus:ring-violet-500' : 'bg-cyan-600 hover:bg-cyan-500 focus:ring-cyan-500'} py-3 font-medium text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${darkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'} disabled:opacity-70 hover:shadow-lg ${darkMode ? 'hover:shadow-violet-500/30' : 'hover:shadow-cyan-500/30'} transform hover:-translate-y-0.5 mt-2`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              ) : (
                isLogin ? "Sign in" : "Create account"
              )}
            </button>
          </form>

          <p className={`mt-6 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={toggleAuthMode}
              className={`ml-1 font-medium ${darkMode ? 'text-violet-400 hover:text-violet-300' : 'text-cyan-600 hover:text-cyan-700'} focus:outline-none hover:underline transition-colors`}
            >
              {isLogin ? "Sign up here" : "Sign in here"}
            </button>
          </p>
        </div>
      </div>

      <p className={`mt-8 text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        &copy; 2025 ShareCode. All rights reserved.
      </p>
    </div>
  );
}
