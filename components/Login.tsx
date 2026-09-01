import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { LogIn, Eye, EyeOff, Check } from 'lucide-react';
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
    setError('');
    setIsLoading(true);

    const submittedUsername = username.trim();
    const submittedPassword = password.trim();

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
        onLogin(user);
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
        setIsLoading(false);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 w-full h-full font-sans overflow-y-auto sm:overflow-hidden select-none bg-slate-900">
      {/* Background Image sân bay phủ kín toàn màn hình */}
      <div 
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url('/bg-airport.jpg'), url('/bg-airport-fallback.jpg')`,
        }}
      >
        {/* Lớp phủ tối mờ nhẹ để bảo đảm độ tương phản chữ và các khối UI */}
        <div className="absolute inset-0 bg-black/15 pointer-events-none"></div>
      </div>

      {/* Header: Trên mobile đưa logo lên trên cùng, chữ xuống dưới tạo không gian hiển thị rộng rãi; trên desktop xếp ngang góc trái */}
      <header className="relative sm:absolute top-0 left-0 right-0 sm:right-auto sm:top-6 sm:left-6 md:top-8 md:left-10 z-20 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 md:gap-4 pt-5 pb-2 px-4 sm:p-0 text-center sm:text-left">
        {/* Logo Đồng Nai - Bỏ nền trắng bao ngoài */}
        <div className="w-12 h-12 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]">
          <img 
            src="/Logo_Dong_Nai.ico" 
            alt="Logo Đồng Nai" 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Tiêu đề Chi nhánh */}
        <div className="flex flex-col">
          <h1 className="text-white text-xs sm:text-sm md:text-base lg:text-lg font-black uppercase tracking-wide leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            VĂN PHÒNG ĐĂNG KÝ THÀNH PHỐ ĐỒNG NAI
          </h1>
          <h2 className="text-yellow-400 text-xs sm:text-xs md:text-sm lg:text-base font-black uppercase tracking-wide leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            CHI NHÁNH HỚN QUẢN
          </h2>
        </div>
      </header>

      {/* Khu vực đăng nhập trung tâm */}
      <main className="relative z-10 w-full min-h-[calc(100%-140px)] sm:min-h-0 sm:h-full flex items-center justify-center p-4 py-6 sm:py-4">
        <div className="w-full max-w-2xl flex flex-col items-center">
          
          {/* Tiêu đề: ĐĂNG NHẬP HỆ THỐNG */}
          <h3 className="text-white text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-center mb-5 sm:mb-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
            ĐĂNG NHẬP HỆ THỐNG
          </h3>

          {/* Form & Logo Hớn Quản:
              - Desktop/Tablet (sm trở lên): Xếp hàng ngang (Form bên trái, Logo bên phải)
              - Mobile (< sm): Xếp dọc với Form ở TRÊN, Logo Hớn Quản ở DƯỚI các nút thao tác đăng nhập */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
            
            {/* Cụm Form nhập liệu */}
            <form onSubmit={handleSubmit} className="w-full max-w-[320px] sm:max-w-[380px] space-y-3 sm:space-y-3.5">
              
              {/* Thông báo lỗi nếu có */}
              {error && (
                <div className="bg-red-600/90 text-white text-xs font-semibold px-4 py-2 rounded-xl backdrop-blur-md shadow-lg drop-shadow text-center border border-red-400/50">
                  {error}
                </div>
              )}

              {/* Ô 1: Tài khoản đăng nhập */}
              <div>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tài khoản đăng nhập"
                  className="w-full px-4 py-3 sm:py-3.5 bg-slate-100/95 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-500 font-semibold rounded-2xl outline-none shadow-md border border-white/60 focus:ring-2 focus:ring-blue-500 transition-all text-sm sm:text-base"
                />
              </div>

              {/* Ô 2: Mật khẩu */}
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  className="w-full pl-4 pr-11 py-3 sm:py-3.5 bg-slate-100/95 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-500 font-semibold rounded-2xl outline-none shadow-md border border-white/60 focus:ring-2 focus:ring-blue-500 transition-all text-sm sm:text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-600 hover:text-slate-900 transition-colors p-1"
                  tabIndex={-1}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Dòng Checkbox: Ghi nhớ đăng nhập */}
              <div className="flex items-center pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      id="rememberMeCheckbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md bg-white/90 border-2 border-white/80 transition-all checked:bg-blue-600 checked:border-blue-600 hover:border-white focus:outline-none shadow-md shadow-black/20"
                    />
                    <Check 
                      size={14} 
                      className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 stroke-[3.5] transition-opacity" 
                    />
                  </div>
                  <span className="text-white text-xs sm:text-sm font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] group-hover:text-blue-200 transition-colors">
                    Ghi nhớ đăng nhập
                  </span>
                </label>
              </div>

              {/* Nút Đăng nhập */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white py-3 sm:py-3.5 rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-blue-600/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed border border-blue-400/30 tracking-wide"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <LogIn size={18} className="stroke-[2.5]" />
                    <span>Đăng nhập</span>
                  </>
                )}
              </button>
            </form>

            {/* Logo Hớn Quản: Bỏ hết nền trắng bao ngoài, hiển thị trong suốt nổi bật trên nền */}
            <div className="shrink-0 flex items-center justify-center">
              <div className="w-24 h-24 sm:w-36 sm:h-36 md:w-40 md:h-40 flex items-center justify-center drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]">
                <img 
                  src="/icon.png" 
                  alt="Logo Hớn Quản" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer ở chân trang */}
      <footer className="relative sm:absolute bottom-3 sm:bottom-4 left-0 right-0 z-20 text-center pb-3 sm:pb-0 pointer-events-none">
        <p className="text-white/95 text-[11px] sm:text-xs font-bold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
          Phần mềm Tiếp nhận & Quản lý Hồ sơ • v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
};

export default Login;
