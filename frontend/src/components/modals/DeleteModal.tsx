import { Trash2 } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  date: string;
}

export function DeleteModal({ isOpen, onConfirm, onCancel, date }: DeleteModalProps) {
  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Layer 1: The Dark Dimming */}
      <div className={`absolute inset-0 bg-black/10 transition-opacity duration-700 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onCancel} />

      {/* Layer 2: The Constant Blur (Faded In/Out) */}
      <div className={`absolute inset-0 backdrop-blur-md transition-opacity duration-700 ease-in-out pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`} />

      <div className={`glass bg-white/95 rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-red-50 rounded-full">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">Delete Snapshot?</h3>
            <p className="text-sm text-gray-500">
              Are you sure you want to delete the scan from <span className="font-semibold text-gray-700">{date}</span>? This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col w-full space-y-2 pt-4">
            <button
              onClick={onConfirm}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              Delete Snapshot
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
