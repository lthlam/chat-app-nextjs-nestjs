import { VideoOff } from 'lucide-react';
import React from 'react';

interface CallVideoRendererProps {
  callType: string;
  isCallActive: boolean;
  isVideoOff: boolean;
  callDuration: number;
  displayName: string;
  otherPerson: any;
  formatTime: (seconds: number) => string;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
}

export function CallVideoRenderer({
  callType, isCallActive, isVideoOff, callDuration, displayName,
  otherPerson, formatTime, localVideoRef, remoteVideoRef, remoteAudioRef
}: CallVideoRendererProps) {
  return (
    <>
      <audio ref={remoteAudioRef} autoPlay />
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Remote Video (Background) */}
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          {callType === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-black"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-blue-600 flex items-center justify-center text-3xl sm:text-4xl font-bold shadow-2xl border-4 border-slate-700 overflow-hidden">
                {otherPerson?.avatar_url ? (
                  <img src={otherPerson.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  (displayName || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="text-center">
                 <h1 className="text-xl sm:text-2xl font-bold mb-1 truncate max-w-[250px] sm:max-w-none text-white">{displayName}</h1>
                 <p className="text-sm sm:text-base text-slate-400">
                   {isCallActive ? `Đang thoại (${formatTime(callDuration)})` : 'Đang kết nối...'}
                 </p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (Floating) */}
        {callType === 'video' && (
          <div className="absolute top-4 right-4 w-32 h-44 sm:w-48 sm:h-64 bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 flex items-center justify-center">
             <div className={`w-full h-full flex items-center justify-center bg-slate-800 ${!isVideoOff ? 'hidden' : ''}`}>
               <VideoOff className="w-8 h-8 text-slate-500" />
             </div>
             <video
               ref={localVideoRef}
               autoPlay
               playsInline
               muted
               className={`w-full h-full object-cover -scale-x-100 ${isVideoOff ? 'hidden' : ''}`}
             />
          </div>
        )}

        {/* Call Status Overlay (Video Mode) */}
        {callType === 'video' && (
          <div className="absolute top-6 left-6 z-10 pointer-events-none">
             <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-white">{formatTime(callDuration)}</span>
             </div>
             <h2 className="mt-2 text-lg font-semibold drop-shadow-lg text-white">{displayName}</h2>
          </div>
        )}
      </div>
    </>
  );
}
