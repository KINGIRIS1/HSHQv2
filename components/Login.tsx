
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { addActivityLog } from '../services/activityLogService';
import { LogIn, User as UserIcon, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { APP_VERSION } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[]; 
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
      const savedUser = localStorage.getItem('saved_username');
      if (savedUser) {
          setUsername(savedUser);
          setRememberMe(true);
      }
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const form = e.currentTarget;
    const usernameInput = form.elements.namedItem('username') as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null;
    
    const submittedUsername = (usernameInput?.value || username || '').trim();
    const submittedPassword = (passwordInput?.value || password || '').trim();
    
    setTimeout(() => {
        const user = users.find(u => {
            const dbUsername = (u.username || '').trim().toLowerCase();
            const dbPassword = (u.password || '').trim();
            return dbUsername === submittedUsername.toLowerCase() && dbPassword === submittedPassword;
        });

        if (user) {
          if (rememberMe) {
              localStorage.setItem('saved_username', submittedUsername);
          } else {
              localStorage.removeItem('saved_username');
          }
          
          addActivityLog({
              performerName: user.name || user.username,
              performerRole: user.role || 'ONEDOOR',
              actionType: 'LOGIN',
              actionLabel: 'Đăng nhập',
              targetType: 'Tài khoản',
              referenceCode: user.username,
              details: `Người dùng ${user.name || user.username} (${user.username}) đăng nhập hệ thống`
          });

          onLogin(user);
        } else {
          setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
          setIsLoading(false);
        }
    }, 600);
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full flex flex-col justify-between items-center font-sans overflow-y-auto bg-cover bg-center bg-no-repeat relative p-4 md:p-8"
      style={{ backgroundImage: 'url("./bg-airport.jpg")' }}
    >
      {/* Light translucent overlay to keep background image clear & vivid */}
      <div className="absolute inset-0 z-0 bg-slate-950/15 pointer-events-none" />

      {/* Top Header: Organization & Department Title */}
      <div className="relative z-10 w-full max-w-7xl flex items-center gap-3 md:gap-4 mb-6 md:mb-0">
        {/* Emblem Badge - new Logo_Dong_Nai.ico */}
        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full shadow-xl flex items-center justify-center shrink-0">
          <img src="./Logo_Dong_Nai.ico" alt="Logo Đồng Nai" className="w-full h-full object-contain rounded-full drop-shadow-md" />
        </div>
        <div className="text-white drop-shadow-lg flex flex-col items-start text-left">
          <h1 className="text-base sm:text-lg md:text-2xl font-black uppercase tracking-wide leading-tight text-white text-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            VĂN PHÒNG ĐĂNG KÝ THÀNH PHỐ ĐỒNG NAI
          </h1>
          <p className="text-base sm:text-lg md:text-2xl font-black uppercase tracking-wide leading-tight text-amber-300 text-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            CHI NHÁNH HỚN QUẢN
          </p>
        </div>
      </div>

      {/* Center Login Card (Completely Transparent) */}
      <div className="relative z-10 w-full max-w-3xl my-auto bg-transparent border-0 shadow-none p-6 md:p-10 animate-fade-in-up">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column: Form Inputs */}
          <div className="md:col-span-7 space-y-5">
            <h2 className="text-xl md:text-2xl font-black text-white text-center uppercase tracking-wider mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              ĐĂNG NHẬP HỆ THỐNG
            </h2>

            {error && (
              <div className="bg-red-600/90 backdrop-blur-md text-white text-sm p-3.5 rounded-xl font-bold flex items-center gap-3 animate-fade-in shadow-lg border border-red-400/30">
                <ShieldAlert size={18} className="shrink-0 text-white" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white drop-shadow">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/20 hover:bg-white/25 focus:bg-white/30 border border-white/60 focus:border-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none transition-all text-white font-bold placeholder-white/80 shadow-md backdrop-blur-md"
                  placeholder="Tài khoản đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              {/* Password Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white drop-shadow">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/20 hover:bg-white/25 focus:bg-white/30 border border-white/60 focus:border-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none transition-all text-white font-bold placeholder-white/80 shadow-md backdrop-blur-md"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/80 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Remember Me Checkbox with explicit check mark */}
              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-white/80 bg-white/30 checked:border-blue-500 checked:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-all"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <CheckCircle2 size={16} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity stroke-[3]" />
                  </div>
                  <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    Ghi nhớ đăng nhập
                  </span>
                </label>
              </div>

              {/* Single Primary Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3.5 px-6 rounded-xl font-bold text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all duration-200 mt-5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <LogIn size={20} />
                    Đăng nhập
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Prominent Pure Circular Logo Display */}
          <div className="md:col-span-5 flex flex-col items-center justify-center pt-6 md:pt-0 text-center">
            <img 
              src="./icon.png?v=4" 
              alt="Logo Văn Phòng Đăng Ký Đất Đai" 
              className="w-36 h-36 md:w-44 md:h-44 object-contain rounded-full drop-shadow-2xl hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      </div>

      {/* Footer Version */}
      <div className="relative z-10 w-full text-center text-xs text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mt-6 md:mt-0">
        Phần mềm Tiếp nhận & Quản lý Hồ sơ • v{APP_VERSION}
      </div>
    </div>
  );
};

export default Login;
