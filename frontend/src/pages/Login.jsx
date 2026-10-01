import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  ArrowLeft,
  Camera,
  ChevronDown,
  RefreshCw,
  Phone,
  Mail,
  X,
} from 'lucide-react';
import OtpInput from '../components/OtpInput';

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳', digits: 10 },
  { name: 'United States', code: '+1', flag: '🇺🇸', digits: 10 },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧', digits: 10 },
  { name: 'UAE', code: '+971', flag: '🇦🇪', digits: 9 },
  { name: 'Canada', code: '+1', flag: '🇨🇦', digits: 10 },
  { name: 'Australia', code: '+61', flag: '🇦🇺', digits: 9 },
  { name: 'Singapore', code: '+65', flag: '🇸🇬', digits: 8 },
  { name: 'Germany', code: '+49', flag: '🇩🇪', digits: 10 },
];

const SilhouetteSVG = () => (
  <svg width="96" height="96" viewBox="0 0 212 212" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="106" cy="106" r="106" fill="#dfe5e7" />
    <path
      fill="#b2bec3"
      d="M106 74.7a28.4 28.4 0 1 1 0 56.8 28.4 28.4 0 0 1 0-56.8zm0 69.3c-31.4 0-56.9 14.3-56.9 32v5.7c15.7 11 34.7 17.5 56.9 17.5s41.2-6.5 56.9-17.5V176c0-17.7-25.5-32-56.9-32z"
    />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, verifyEmailOtp, setupProfile } = useAuth();

  const [authMode, setAuthMode] = useState('phone');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Phone state
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [fullPhone, setFullPhone] = useState('');

  // Email state
  const [email, setEmail] = useState('');

  // OTP state
  const [otpCode, setOtpCode] = useState('');

  // Profile state
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [aboutText, setAboutText] = useState('Hey there! I am using WhatsApp.');
  const fileRef = useRef(null);

  const [savedPhone, setSavedPhone] = useState('');
  const [savedEmail, setSavedEmail] = useState('');

  const switchMode = (mode) => {
    setAuthMode(mode);
    setStep(1);
    setErrorMsg('');
    setPhone('');
    setEmail('');
    setOtpCode('');
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    if (authMode === 'phone') {
      const clean = phone.replace(/\D/g, '');
      if (!clean || clean.length < selectedCountry.digits) {
        setErrorMsg(`Enter a valid ${selectedCountry.digits}-digit mobile number.`);
        return;
      }
      const formatted = `${selectedCountry.code}${clean}`;
      setLoading(true);
      try {
        await sendPhoneOtp(formatted);
        setFullPhone(formatted);
        setSavedPhone(formatted);
        setOtpCode('');
        setStep(2);
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Failed to send OTP. Try again.');
      } finally {
        setLoading(false);
      }
    } else {
      const emailVal = email.trim().toLowerCase();
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        setErrorMsg('Enter a valid email address.');
        return;
      }
      setLoading(true);
      try {
        await sendEmailOtp(emailVal);
        setSavedEmail(emailVal);
        setOtpCode('');
        setStep(2);
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Failed to send email OTP. Try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const submitOtp = async (otp) => {
    if (!otp || otp.length < 6) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const data =
        authMode === 'phone'
          ? await verifyPhoneOtp(fullPhone, otp)
          : await verifyEmailOtp(savedEmail, otp);

      if (data.isNewUser) {
        setStep(3);
      } else {
        navigate('/chat');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid OTP code.');
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatar('');
    setAvatarPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await setupProfile({
        phone: savedPhone || undefined,
        email: savedEmail || undefined,
        name: name.trim(),
        profilePic: avatar || '',
        about: aboutText,
      });
      navigate('/chat');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#eae6df] flex flex-col items-center justify-start relative select-none">
      <div className="w-full h-[160px] sm:h-[200px] bg-[#00a884] absolute top-0 left-0 z-0" />

      <div className="relative z-10 mt-6 sm:mt-[60px] w-full max-w-[480px] px-3.5 sm:px-4 pb-8">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_17px_50px_0_rgba(11,20,26,0.19)] border border-[#e9edef] overflow-hidden">
          <div className="h-1.5 w-full bg-[#00a884]" />

          <div className="p-6 sm:p-10">
            {/* Step 1: Phone / Email input */}
            {step === 1 && (
              <div>
                <div className="flex flex-col items-center mb-7">
                  <div className="w-14 h-14 rounded-full bg-[#00a884] flex items-center justify-center mb-3 shadow-lg">
                    <MessageSquare size={28} className="fill-white text-[#00a884]" />
                  </div>
                  <h2 className="text-2xl font-light text-[#41525d]">Log in to ChatApp</h2>
                  <p className="text-sm text-[#667781] text-center mt-1">
                    Enter your details to get a verification code.
                  </p>
                </div>

                <div className="flex bg-[#f0f2f5] rounded-xl p-1 mb-7">
                  <button
                    type="button"
                    onClick={() => switchMode('phone')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      authMode === 'phone'
                        ? 'bg-white text-[#00a884] shadow-sm'
                        : 'text-[#667781] hover:text-[#111b21]'
                    }`}
                  >
                    <Phone size={15} />
                    Phone Number
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      authMode === 'email'
                        ? 'bg-white text-[#00a884] shadow-sm'
                        : 'text-[#667781] hover:text-[#111b21]'
                    }`}
                  >
                    <Mail size={15} />
                    Email Address
                  </button>
                </div>

                {errorMsg && (
                  <div className="mb-5 p-3 text-xs bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
                    {errorMsg}
                  </div>
                )}

                {authMode === 'phone' ? (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                      <label className="text-xs text-[#667781] block mb-1.5 font-medium">Country</label>
                      <div className="relative">
                        <select
                          value={`${selectedCountry.name}-${selectedCountry.code}`}
                          onChange={(e) => {
                            const [, code] = e.target.value.split('-');
                            const c = COUNTRIES.find((item) => item.code === code && `${item.name}-${item.code}` === e.target.value);
                            if (c) setSelectedCountry(c);
                          }}
                          className="w-full bg-white border-b-2 border-[#00a884] py-2.5 px-3 text-[#111b21] font-medium text-base focus:outline-none appearance-none cursor-pointer pr-10"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={`${c.name}-${c.code}`} value={`${c.name}-${c.code}`}>
                              {c.flag} {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-2 top-3.5 text-[#8696a0] pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[#667781] block mb-1.5 font-medium">Phone Number</label>
                      <div className="flex items-center gap-3 border-b-2 border-[#00a884] py-1.5">
                        <span className="text-[#111b21] font-semibold text-base shrink-0">{selectedCountry.code}</span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, selectedCountry.digits))}
                          placeholder={`${selectedCountry.digits}-digit mobile number`}
                          autoFocus
                          className="w-full text-base text-[#111b21] placeholder-[#8696a0] focus:outline-none bg-transparent"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-[#8696a0] mt-1">Carrier SMS charges may apply.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !phone.trim()}
                      className="w-full bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm tracking-wide uppercase transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {loading ? <><RefreshCw size={16} className="animate-spin" /><span>Sending...</span></> : 'Next'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                      <label className="text-xs text-[#667781] block mb-1.5 font-medium">Email Address</label>
                      <div className="flex items-center border-b-2 border-[#00a884] py-1.5">
                        <Mail size={17} className="text-[#8696a0] mr-3 shrink-0" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoFocus
                          className="w-full text-base text-[#111b21] placeholder-[#8696a0] focus:outline-none bg-transparent"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-[#8696a0] mt-1">A 6-digit code will be sent to this email.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm tracking-wide uppercase transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {loading ? <><RefreshCw size={16} className="animate-spin" /><span>Sending...</span></> : 'Send Code'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setErrorMsg(''); }}
                  className="flex items-center gap-1.5 text-xs text-[#00a884] hover:underline mb-5 font-medium cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  {authMode === 'phone' ? 'Wrong number? Edit' : 'Wrong email? Edit'}
                </button>

                <div className="flex flex-col items-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-[#00a884]/10 flex items-center justify-center mb-3">
                    {authMode === 'phone' ? (
                      <Phone size={22} className="text-[#00a884]" />
                    ) : (
                      <Mail size={22} className="text-[#00a884]" />
                    )}
                  </div>
                  <h2 className="text-xl font-normal text-[#41525d] text-center">Enter 6-digit code</h2>
                  <p className="text-xs text-[#667781] text-center mt-1">
                    Code sent to{' '}
                    <span className="font-semibold text-[#111b21]">
                      {authMode === 'phone' ? fullPhone : savedEmail}
                    </span>
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-4 p-3 text-xs bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
                    {errorMsg}
                  </div>
                )}

                <OtpInput
                  onChange={(code) => setOtpCode(code)}
                  onComplete={(code) => submitOtp(code)}
                  onResend={handleSendOtp}
                  countdownSeconds={30}
                  disabled={loading}
                  error={errorMsg}
                />

                <button
                  type="button"
                  disabled={loading || otpCode.length < 6}
                  onClick={() => submitOtp(otpCode)}
                  className="w-full mt-7 bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm tracking-wide uppercase transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>
              </div>
            )}

            {/* Step 3: Profile Setup */}
            {step === 3 && (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-light text-[#41525d]">Profile info</h2>
                  <p className="text-xs text-[#667781] mt-1">
                    Provide your name and an optional profile photo.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-5 p-3 text-xs bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                      {avatarPreview ? (
                        <>
                          <img
                            src={avatarPreview}
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover border-4 border-[#e9edef] shadow-md"
                          />
                          <button
                            type="button"
                            onClick={removeAvatar}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <SilhouetteSVG />
                      )}

                      <label
                        htmlFor="avatarUpload"
                        className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity opacity-0 group-hover:opacity-100"
                      >
                        <Camera size={22} />
                        <span className="text-[10px] mt-1 font-medium">{avatarPreview ? 'CHANGE' : 'ADD PHOTO'}</span>
                      </label>
                      <input
                        id="avatarUpload"
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <p className="text-[11px] text-[#8696a0]">
                      {avatarPreview ? 'Click photo to change or ✕ to remove' : 'Click to add a profile photo (optional)'}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-[#667781] font-medium">Your Name</label>
                      <span className="text-[11px] text-[#8696a0]">{name.length}/25</span>
                    </div>
                    <input
                      type="text"
                      value={name}
                      maxLength={25}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Type your name here"
                      autoFocus
                      className="w-full border-b-2 border-[#00a884] py-2 text-[#111b21] font-medium text-base focus:outline-none bg-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#667781] font-medium block mb-1">About</label>
                    <input
                      type="text"
                      value={aboutText}
                      maxLength={120}
                      onChange={(e) => setAboutText(e.target.value)}
                      placeholder="Hey there! I am using WhatsApp."
                      className="w-full border-b border-[#e9edef] py-1.5 text-xs text-[#54656f] focus:outline-none focus:border-[#00a884] bg-transparent transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="w-full bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm tracking-wide uppercase transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Creating profile...</span>
                      </>
                    ) : (
                      'Done'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-5 text-xs text-[#667781] flex items-center justify-center gap-1.5">
          🔒 End-to-end encrypted
        </div>
      </div>
    </div>
  );
};

export default Login;
