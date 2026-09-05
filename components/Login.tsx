import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { LogIn, Eye, EyeOff, Check } from 'lucide-react';
import { APP_VERSION, MOCK_USERS } from '../constants';

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

    const submittedUsername = username.trim().toLowerCase();
    const submittedPassword = password.trim();

    setTimeout(() => {
      // 1. Kiểm tra trong danh sách users prop truyền vào từ App
      let matchedUser = users && users.length > 0 ? users.find(u => {
        const dbUsername = (u.username || '').trim().toLowerCase();
        const dbPassword = (u.password || '').trim();
        return dbUsername === submittedUsername && dbPassword === submittedPassword;
      }) : null;

      // 2. Dự phòng: Kiểm tra trong bộ nhớ đệm cache (phòng khi prop users chưa kịp nạp)
      if (!matchedUser && typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(localStorage.getItem('app_users_cache_v1') || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            matchedUser = cached.find((u: any) => {
              const dbUsername = (u.username || u.user_name || '').trim().toLowerCase();
              const dbPassword = (u.password !== undefined ? String(u.password) : (u.pass !== undefined ? String(u.pass) : '')).trim();
              return dbUsername === submittedUsername && dbPassword === submittedPassword;
            });
          }
        } catch (e) {
          console.warn("Lỗi đọc user cache:", e);
        }
      }

      // 3. Dự phòng cấp cao nhất: Kiểm tra trong danh sách tài khoản mặc định MOCK_USERS
      if (!matchedUser) {
        matchedUser = MOCK_USERS.find(u => {
          const dbUsername = (u.username || '').trim().toLowerCase();
          const dbPassword = (u.password || '').trim();
          return dbUsername === submittedUsername && dbPassword === submittedPassword;
        });
      }

      if (matchedUser) {
        if (rememberMe) {
          localStorage.setItem('saved_username', username.trim());
        } else {
          localStorage.removeItem('saved_username');
        }
        onLogin(matchedUser);
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
        setIsLoading(false);
      }
    }, 250);
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

      {/* Header: Căn giữa logo lên trên và chữ xuống dưới trên cả mobile và PC */}
      <header className="relative top-0 left-0 right-0 z-20 flex flex-col items-center text-center pt-4 pb-1 px-4 sm:pt-6 sm:pb-2">
        {/* Logo Đồng Nai - Bỏ nền trắng bao ngoài */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)] mb-1.5 sm:mb-2">
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
        <div className="flex flex-col items-center">
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
