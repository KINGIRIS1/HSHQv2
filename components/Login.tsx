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
    <div className="fixed inset-0 w-full h-full font-sans overflow-y-auto sm:overflow-hidden select-none bg-slate-950 flex flex-col justify-between items-center">
      {/* Background Image sân bay phủ kín toàn màn hình */}
      <div 
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url('/bg-airport.jpg'), url('/bg-airport-fallback.jpg')`,
        }}
      >
        {/* Lớp phủ tối mờ tinh chỉnh độ tương phản và chiều sâu sắc nét */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/60 pointer-events-none"></div>
      </div>

      {/* Header: Logo và Tên Chi nhánh phân bổ cân đối ở đỉnh trang */}
      <header className="relative z-20 w-full flex flex-col items-center text-center pt-5 sm:pt-7 md:pt-9 px-4 shrink-0">
        {/* Logo Đồng Nai */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] mb-2 sm:mb-2.5">
          <img 
            src="/Logo_Dong_Nai.ico" 
            alt="Logo Đồng Nai" 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Tiêu đề Chi nhánh - Kích thước chữ sắc nét, tương đối và hài hòa */}
        <div className="flex flex-col items-center max-w-4xl px-2">
          <h1 className="text-white text-base sm:text-lg md:text-xl lg:text-2xl font-black uppercase tracking-wide leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            VĂN PHÒNG ĐĂNG KÝ THÀNH PHỐ ĐỒNG NAI
          </h1>
          <h2 className="text-yellow-400 text-sm sm:text-base md:text-lg lg:text-xl font-black uppercase tracking-wide leading-snug mt-0.5 sm:mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            CHI NHÁNH HỚN QUẢN
          </h2>
        </div>
      </header>

      {/* Khu vực đăng nhập trung tâm: Tỷ lệ chuẩn mực, phân bổ khoảng cách đồng đều */}
      <main className="relative z-10 w-full flex-1 flex items-center justify-center p-4 py-5 sm:py-6 my-auto">
        <div className="w-full max-w-[350px] sm:max-w-[400px] md:max-w-[420px] flex flex-col items-center">
          
          {/* Tiêu đề: ĐĂNG NHẬP HỆ THỐNG - Căn giữa thẳng hàng hoàn hảo với khung tài khoản mật khẩu */}
          <div className="w-full text-center mb-4 sm:mb-5">
            <h3 className="text-white text-lg sm:text-xl md:text-2xl font-black uppercase tracking-wider leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              ĐĂNG NHẬP HỆ THỐNG
            </h3>
          </div>

          {/* Cụm Form nhập liệu */}
          <form onSubmit={handleSubmit} className="w-full space-y-3.5 sm:space-y-4">
            
            {/* Thông báo lỗi nếu có */}
            {error && (
              <div className="bg-red-600/90 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl backdrop-blur-md shadow-lg drop-shadow text-center border border-red-400/50">
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
                className="w-full px-4 py-3 sm:py-3.5 bg-slate-100/95 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-500 font-semibold rounded-2xl outline-none shadow-md border border-white/70 focus:ring-2 focus:ring-blue-500 transition-all text-sm sm:text-base"
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
                className="w-full pl-4 pr-11 py-3 sm:py-3.5 bg-slate-100/95 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-500 font-semibold rounded-2xl outline-none shadow-md border border-white/70 focus:ring-2 focus:ring-blue-500 transition-all text-sm sm:text-base"
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

        </div>
      </main>

      {/* Footer ở chân trang */}
      <footer className="relative z-20 w-full text-center pb-4 sm:pb-5 px-4 shrink-0 pointer-events-none">
        <p className="text-white/95 text-[11px] sm:text-xs font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          Phần mềm Tiếp nhận & Quản lý Hồ sơ • v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
};

export default Login;
