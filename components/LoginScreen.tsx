import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (password: string) => Promise<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onLogin(password);
    if (!success) {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
        {/* Logo/Header */}
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
                <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Restricted Access</h1>
            <p className="text-gray-500 dark:text-gray-400">
                This tool is for internal use only. <br/>Please enter the access code to continue.
            </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <div className={`relative transition-transform ${shake ? 'translate-x-[-4px]' : ''}`}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError(false);
                        }}
                        placeholder="Enter access code"
                        className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all
                            ${error 
                                ? 'border-red-500 focus:ring-red-500/20' 
                                : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                            }`}
                        autoFocus
                    />
                    {error && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 animate-in fade-in">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-xs text-red-500 text-center font-medium animate-in slide-in-from-top-1">
                        Incorrect access code. Please try again.
                    </p>
                )}
            </div>

            <button
                type="submit"
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
                Continue <ArrowRight className="w-4 h-4" />
            </button>
        </form>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-600 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Secure Client Area
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;