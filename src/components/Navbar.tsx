/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Tv, Film, Compass, User } from 'lucide-react';

export type TabType = 'tv' | 'movies' | 'explore' | 'profile';

interface NavbarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export function Navbar({ activeTab, onChangeTab }: NavbarProps) {
  const tabs = [
    { id: 'tv' as TabType, label: 'TV Shows', icon: Tv },
    { id: 'movies' as TabType, label: 'Movies', icon: Film },
    { id: 'explore' as TabType, label: 'Explore', icon: Compass },
    { id: 'profile' as TabType, label: 'Profile', icon: User },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5 flex justify-center shadow-2xl"
    >
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-7xl flex justify-around items-center h-16 px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-grow py-2 transition-all cursor-pointer select-none ${
                isActive
                  ? 'text-amber-500 font-bold scale-105'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5.5 h-5.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium tracking-wide">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
