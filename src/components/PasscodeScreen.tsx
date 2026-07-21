/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, X, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PasscodeScreenProps {
  mode: 'unlock' | 'setup' | 'disable' | 'change';
  correctPasscode: string | null;
  onSuccess: (newCode?: string) => void;
  onCancel?: () => void;
}

export function PasscodeScreen({ mode, correctPasscode, onSuccess, onCancel }: PasscodeScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [step, setStep] = useState<'enter_new' | 'confirm_new' | 'verify_current'>('verify_current');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (mode === 'setup') {
      setStep('enter_new');
    } else {
      setStep('verify_current');
    }
    setPin('');
    setConfirmPin('');
    setError(null);
  }, [mode]);

  const handleNumberPress = (num: string) => {
    setError(null);
    if (step === 'enter_new') {
      if (pin.length < 4) {
        setPin(prev => prev + num);
      }
    } else if (step === 'confirm_new') {
      if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + num);
      }
    } else {
      // verify_current or unlock mode
      if (pin.length < 4) {
        setPin(prev => prev + num);
      }
    }
  };

  const handleBackspace = () => {
    setError(null);
    if (step === 'confirm_new') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setError(null);
    if (step === 'confirm_new') {
      setConfirmPin('');
    } else {
      setPin('');
    }
  };

  // Triggered when 4 digits are entered
  useEffect(() => {
    const currentInput = step === 'confirm_new' ? confirmPin : pin;
    if (currentInput.length !== 4) return;

    const timer = setTimeout(() => {
      if (mode === 'unlock') {
        if (pin === correctPasscode) {
          onSuccess();
        } else {
          triggerError('Incorrect passcode. Please try again.');
        }
      } else if (mode === 'disable') {
        if (pin === correctPasscode) {
          onSuccess();
        } else {
          triggerError('Incorrect passcode. Cannot disable.');
        }
      } else if (mode === 'setup') {
        if (step === 'enter_new') {
          setStep('confirm_new');
        } else if (step === 'confirm_new') {
          if (pin === confirmPin) {
            onSuccess(pin);
          } else {
            triggerError('Passcodes do not match. Restarting setup...');
            setPin('');
            setConfirmPin('');
            setStep('enter_new');
          }
        }
      } else if (mode === 'change') {
        if (step === 'verify_current') {
          if (pin === correctPasscode) {
            setStep('enter_new');
            setPin('');
          } else {
            triggerError('Incorrect current passcode.');
          }
        } else if (step === 'enter_new') {
          setStep('confirm_new');
        } else if (step === 'confirm_new') {
          if (pin === confirmPin) {
            onSuccess(pin);
          } else {
            triggerError('Passcodes do not match. Restarting setup...');
            setPin('');
            setConfirmPin('');
            setStep('enter_new');
          }
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [pin, confirmPin, step, mode, correctPasscode]);

  const triggerError = (msg: string) => {
    setError(msg);
    setIsShaking(true);
    if (step === 'confirm_new') {
      setConfirmPin('');
    } else {
      setPin('');
    }
    setTimeout(() => setIsShaking(false), 500);
  };

  // Capture keyboard input for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, pin, confirmPin, onCancel]);

  const getTitle = () => {
    if (mode === 'unlock') return 'Enter Passcode';
    if (mode === 'disable') return 'Enter Passcode to Disable';
    
    if (mode === 'setup') {
      return step === 'enter_new' ? 'Choose New Passcode' : 'Confirm New Passcode';
    }
    
    if (mode === 'change') {
      if (step === 'verify_current') return 'Enter Current Passcode';
      return step === 'enter_new' ? 'Choose New Passcode' : 'Confirm New Passcode';
    }
    return '';
  };

  const getSubtitle = () => {
    if (mode === 'unlock') return 'This website is private. Enter the 4-digit master passcode to gain access.';
    if (mode === 'disable') return 'Verify the current master passcode to disable website lock';
    if (step === 'verify_current') return 'Confirm the current master passcode to set a new one';
    if (step === 'enter_new') return 'Create a 4-digit master passcode';
    return 'Re-enter your 4-digit code to verify';
  };

  const currentDisplayPin = step === 'confirm_new' ? confirmPin : pin;

  return (
    <div 
      className={`fixed inset-0 z-[999] bg-[#050505]/95 backdrop-blur-xl flex flex-col justify-center items-center p-6 select-none`}
    >
      {/* Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top action buttons (Close for dialog modes) */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Main Panel */}
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-8">
        
        {/* Animated Lock Icon */}
        <div className="relative">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/10 shadow-lg shadow-amber-500/5">
            {mode === 'unlock' ? (
              <Lock className="w-7.5 h-7.5 text-amber-500" />
            ) : (
              <Unlock className="w-7.5 h-7.5 text-amber-500" />
            )}
          </div>
        </div>

        {/* Header Text */}
        <div className="space-y-1.5">
          <h2 className="font-display font-black text-xl text-[#F5F5F5] tracking-tight">
            {getTitle()}
          </h2>
          <p className="text-xs text-zinc-400 font-medium max-w-xs leading-normal">
            {getSubtitle()}
          </p>
        </div>

        {/* Circular Dot Indicators */}
        <motion.div 
          animate={isShaking ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center items-center gap-5 py-4"
        >
          {[0, 1, 2, 3].map((index) => {
            const hasValue = currentDisplayPin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  hasValue 
                    ? 'bg-amber-500 border-amber-500 scale-110 shadow-md shadow-amber-500/35' 
                    : 'bg-transparent border-zinc-700'
                }`}
              />
            );
          })}
        </motion.div>

        {/* Error message */}
        <div className="h-4 text-center">
          <AnimatePresence mode="wait">
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-xs font-semibold text-red-500"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Numerical Keypad */}
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 w-full px-4 max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberPress(num)}
              className="w-16 h-16 rounded-full bg-zinc-900/40 hover:bg-zinc-800/80 active:scale-90 text-xl font-bold font-display text-zinc-100 flex items-center justify-center border border-white/5 transition-all shadow-sm cursor-pointer select-none"
            >
              {num}
            </button>
          ))}
          
          {/* Bottom Row */}
          <button
            onClick={handleClear}
            className="w-16 h-16 rounded-full hover:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
          >
            Clear
          </button>

          <button
            onClick={() => handleNumberPress('0')}
            className="w-16 h-16 rounded-full bg-zinc-900/40 hover:bg-zinc-800/80 active:scale-90 text-xl font-bold font-display text-zinc-100 flex items-center justify-center border border-white/5 transition-all shadow-sm cursor-pointer select-none"
          >
            0
          </button>

          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-full hover:bg-white/5 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Helpful instructions / tips */}
        {mode === 'unlock' && (
          <p className="text-[10px] text-zinc-600 font-medium max-w-[240px] leading-relaxed select-none">
            To manage or configure this application, please enter the master security code.
          </p>
        )}

      </div>
    </div>
  );
}
