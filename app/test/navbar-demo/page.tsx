'use client';

import { ClubLogo } from '@/components/ClubLogo';

export default function NavbarDemoPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b-2 border-orange-500 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Club Logo + App Name */}
          <div className="flex items-center gap-4">
            <ClubLogo
              logoUrl="/images/seasonmath-logo.png"
              clubName="SeasonMath Demo Club"
              size="md"
            />
            <span className="text-white font-bold text-xl">Basquet Stat</span>
          </div>
          
          {/* Right: User Info */}
          <div className="flex items-center gap-4">
            {/* Role Pills */}
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
                Admin
              </span>
              <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                Team Manager
              </span>
            </div>
            
            {/* User Avatar + Name */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                OM
              </div>
              <span className="text-white font-medium">Oscar Moreno</span>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="flex items-center justify-center h-full pt-20">
        <div className="text-center text-gray-400">
          <p className="text-2xl mb-2">Navbar Demo</p>
          <p>Shows club logo, app name, role pills, user avatar, and name</p>
        </div>
      </div>
    </div>
  );
}
