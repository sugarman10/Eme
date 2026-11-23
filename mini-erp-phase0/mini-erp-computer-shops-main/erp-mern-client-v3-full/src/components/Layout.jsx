import { useState } from 'react'
import TopNavigation from './TopNavigation'
import BreadcrumbsNav from './BreadcrumbsNav'
import { Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const isPos = location.pathname === '/pos'
  const [showNavInPos, setShowNavInPos] = useState(false)

  return (
    <div className="min-h-screen max-w-full overflow-x-clip flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Navigation Bar - Hidden in POS mode for full immersion unless toggled */}
      {(!isPos || showNavInPos) && <TopNavigation />}

      {/* Main Content Area */}
      {isPos ? (
        <main className={`flex-1 w-full ${showNavInPos ? 'h-[calc(100vh-80px)]' : 'h-screen'} overflow-hidden flex flex-col`}>
          <Outlet context={{ showNavInPos, setShowNavInPos }} />
        </main>
      ) : (
        <main className="flex-1 w-full max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 py-5">
          {/* Dynamic Breadcrumbs & Quick Shortcuts */}
          <BreadcrumbsNav />

          <div className="animate-in fade-in duration-200">
            <Outlet />
          </div>
        </main>
      )}
    </div>
  )
}