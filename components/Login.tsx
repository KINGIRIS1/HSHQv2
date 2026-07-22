
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, LogIn, User as UserIcon, Lock, CheckCircle2 } from 'lucide-react';

import { APP_VERSION } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[]; 
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
        const user = users.find(u => u.username?.toLowerCase() === username?.toLowerCase() && u.password === password);
        if (user) {
          if (rememberMe) {
              localStorage.setItem('saved_username', username);
          } else {
              localStorage.removeItem('saved_username');
          }
          
          onLogin(user);
        } else {
          setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
          setIsLoading(false);
        }
    }, 600);
  };

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-[#0f172a] font-sans overflow-hidden">
      {/* Background Decor - Giữ nguyên hiệu ứng cho giống App */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px]"></div>
      </div>

      <div className="w-full max-w-[1100px] h-[80vh] min-h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden flex z-10 animate-fade-in-up m-4 border border-slate-800/50">
        
        {/* Left Side: Brand & Info (Dark Theme) */}
        <div className="hidden md:flex w-5/12 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white p-12 flex-col justify-between relative overflow-hidden">
            {/* Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <div className="relative z-10">
                <div className="mb-8">
                    <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30 w-fit">
                        <ShieldCheck size={32} className="text-white" />
                    </div>
                </div>
                
                <h1 className="text-3xl lg:text-4xl font-extrabold leading-snug mb-6 tracking-tight text-white">
                    Hệ thống tiếp nhận và quản lý hồ sơ
                </h1>
                
                <p className="text-slate-400 text-base leading-relaxed border-l-2 border-blue-500/50 pl-5 max-w-sm">
                    Hỗ trợ tiếp nhận và quản lý hiệu quả hồ sơ cho Chi nhánh Văn phòng Đăng ký Đất đai
                </p>
            </div>

            <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-blue-600/20 transition-all duration-300 border border-slate-700 group-hover:border-blue-500/50">
                        <CheckCircle2 size={18} className="text-green-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-slate-300 font-medium group-hover:text-white transition-colors">Quy trình khép kín & bảo mật</span>
                </div>
                <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-blue-600/20 transition-all duration-300 border border-slate-700 group-hover:border-blue-500/50">
                        <CheckCircle2 size={18} className="text-green-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-slate-300 font-medium group-hover:text-white transition-colors">Tích hợp AI</span>
                </div>
                <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-blue-600/20 transition-all duration-300 border border-slate-700 group-hover:border-blue-500/50">
                        <CheckCircle2 size={18} className="text-green-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-slate-300 font-medium group-hover:text-white transition-colors">Báo cáo & Thống kê trực quan</span>
                </div>
            </div>

            <div className="relative z-10 mt-10 pt-6 border-t border-slate-800 flex justify-between items-end">
                <div>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">System Version</p>
                    <p className="text-xs text-slate-300 font-semibold">{APP_VERSION} • Chi nhánh Hớn Quản</p>
                </div>
            </div>

            {/* Decor Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[60px] -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
        </div>

        {/* Right Side: Login Form (White Theme) */}
        <div className="w-full md:w-7/12 p-8 md:p-16 flex flex-col justify-center bg-white relative">
            <div className="max-w-md mx-auto w-full">
                <div className="mb-10">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Xin chào! <span className="animate-wave text-3xl">👋</span></h2>
                    <p className="text-slate-500">Đăng nhập để truy cập không gian làm việc của bạn.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 font-medium flex items-center gap-3 animate-fade-in shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Tài khoản</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <UserIcon size={20} className="text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            </div>
                            <input
                                type="text"
                                required
                                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50 group-hover:bg-white focus:bg-white font-medium text-slate-800 placeholder-slate-400"
                                placeholder="Nhập tên đăng nhập..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-sm font-bold text-slate-700">Mật khẩu</label>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock size={20} className="text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            </div>
                            <input
                                type="password"
                                required
                                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50 group-hover:bg-white focus:bg-white font-medium text-slate-800 placeholder-slate-400"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center mt-2">
                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 hover:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                    <CheckCircle2 size={12} strokeWidth={4} />
                                </div>
                            </div>
                            <span className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                                Ghi nhớ đăng nhập
                            </span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl transition-all font-bold text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Đăng nhập hệ thống
                            </>
                        )}
                    </button>
                </form>
            </div>
            
            <div className="absolute bottom-6 right-8 hidden md:flex items-center gap-2">
               <div className="flex items-center gap-2 text-slate-400/70 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="text-[10px] font-bold uppercase tracking-wider">Secure Connection</span>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
