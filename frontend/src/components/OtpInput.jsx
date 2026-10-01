import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

const OtpInput = ({
  onChange,
  onComplete,
  onResend,
  countdownSeconds = 30,
  disabled = false,
  error = '',
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(countdownSeconds);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  const canResend = countdown <= 0;

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index, val) => {
    if (disabled) return;
    const cleanDigit = val.replace(/\D/g, '').slice(-1);
    const updated = [...digits];
    updated[index] = cleanDigit;
    setDigits(updated);

    const otpStr = updated.join('');
    if (onChange) onChange(otpStr);

    if (cleanDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (cleanDigit && index === 5 && updated.every((d) => d !== '')) {
      if (onComplete) onComplete(otpStr);
    }
  };

  const handleKeyDown = (index, e) => {
    if (disabled) return;
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    if (disabled) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setDigits(updated);

    const otpStr = updated.join('');
    if (onChange) onChange(otpStr);

    if (pasted.length === 6) {
      inputRefs.current[5]?.focus();
      if (onComplete) onComplete(otpStr);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleResendClick = async () => {
    if (!canResend || resending || disabled) return;
    setResending(true);
    try {
      if (onResend) await onResend();
      setDigits(['', '', '', '', '', '']);
      setCountdown(countdownSeconds);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full select-none">
      <div className="flex justify-between items-center gap-2 sm:gap-3 my-6" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            name={`otp-code-${i}`}
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-lpignore="true"
            className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-bold text-[#111b21] bg-[#f0f2f5] border-2 rounded-xl focus:bg-white focus:outline-none transition-all shadow-inner ${
              error
                ? 'border-red-400 focus:border-red-500'
                : digit
                ? 'border-[#00a884]'
                : 'border-transparent focus:border-[#00a884]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        ))}
      </div>

      <div className="text-center text-xs text-[#667781] flex items-center justify-center gap-1.5 mt-2">
        {canResend ? (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={resending || disabled}
            className="text-[#00a884] font-semibold hover:text-[#008069] hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {resending ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Sending new code...</span>
              </>
            ) : (
              <span>Resend OTP</span>
            )}
          </button>
        ) : (
          <span>
            Resend OTP in{' '}
            <strong className="text-[#111b21] font-semibold">
              0:{countdown < 10 ? `0${countdown}` : countdown}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default OtpInput;
