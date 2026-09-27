'use client';

import { useSearchParams } from 'next/navigation';

export default function ProfileDemoPage() {
  const searchParams = useSearchParams();
  const isDark = searchParams.get('theme') !== 'light';
  const bgClass = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
  const inputClass = isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  return (
    <div className={`min-h-screen ${bgClass} p-8`}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Profile</h1>
        
        <div className={`${cardClass} border rounded-xl p-6 space-y-6`}>
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              OM
            </div>
            <div>
              <p className="text-lg font-bold">Oscar Moreno</p>
              <p className="text-sm text-gray-500">oscar@seasonmath.com</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">Admin</span>
                <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">Team Manager</span>
              </div>
            </div>
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value="oscar@seasonmath.com"
              className={`w-full px-4 py-2 rounded-lg border ${inputClass}`}
              disabled
            />
          </div>
          
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              value="Oscar Moreno"
              className={`w-full px-4 py-2 rounded-lg border ${inputClass}`}
            />
          </div>
          
          {/* Current Password (for changes) */}
          <div>
            <label className="block text-sm font-medium mb-2">Current Password (required for changes)</label>
            <input
              type="password"
              placeholder="Enter current password to make changes"
              className={`w-full px-4 py-2 rounded-lg border ${inputClass}`}
            />
          </div>
          
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium mb-2">New Password (optional)</label>
            <input
              type="password"
              placeholder="Leave blank to keep current password"
              className={`w-full px-4 py-2 rounded-lg border ${inputClass}`}
            />
          </div>
          
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dark Mode</span>
            <button className="w-14 h-7 bg-blue-600 rounded-full relative">
              <span className={`absolute top-0.5 ${isDark ? 'right-0.5' : 'left-0.5'} w-6 h-6 bg-white rounded-full transition-all`} />
            </button>
          </div>
          
          {/* Save Button */}
          <button className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
