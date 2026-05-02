import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';

interface CallControlsProps {
  callType: string;
  isMuted: boolean;
  isVideoOff: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
  stopCall: (emit: boolean) => void;
}

export function CallControls({
  callType, isMuted, isVideoOff, toggleMute, toggleVideo, stopCall
}: CallControlsProps) {
  return (
    <div className="absolute bottom-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 z-20 px-6 py-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 max-w-[95%]">
      <button
        onClick={toggleMute}
        className={`p-4 sm:p-5 rounded-full transition-all active:scale-90 ${
          isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
      </button>

      {callType === 'video' && (
        <button
          onClick={toggleVideo}
          className={`p-4 sm:p-5 rounded-full transition-all active:scale-90 ${
            isVideoOff ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
      )}
      
      <button
        onClick={() => stopCall(true)}
        className="p-5 sm:p-6 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-xl hover:scale-110 active:scale-90"
      >
        <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
      </button>
    </div>
  );
}
