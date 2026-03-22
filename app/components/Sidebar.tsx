'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useTheme } from '../ThemeProvider'
import styles from './Sidebar.module.css'

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

    const links = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/dashboard/trades', icon: '📓', label: 'Trade Log' },
    { href: '/dashboard/add-trade', icon: '➕', label: 'Add Trade' },
    { href: '/dashboard/analytics', icon: '📈', label: 'Analytics' },
    { href: '/dashboard/playbook', icon: '📋', label: 'Playbook' },
    { href: '/dashboard/risk', icon: '🛡️', label: 'Risk Rules' },
    { href: '/dashboard/ai-coach', icon: '🤖', label: 'AI Coach' },
    { href: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <span className={styles.logoIcon}>◈</span>
        <span className={styles.logoText}>FuturesJournal</span>
      </div>

      <nav className={styles.sidebarNav}>
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.navItem} ${pathname === link.href ? styles.navItemActive : ''}`}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className={styles.sidebarBottom}>
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className={styles.themeToggle}>
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {userEmail ? userEmail[0].toUpperCase() : '?'}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userEmail}>{userEmail}</span>
            <span className={styles.userPlan}>Free Plan</span>
          </div>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Sign out
        </button>
      </div>
    </aside>
  )
}