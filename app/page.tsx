import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.logoIcon}>◈</span>
          <span className={styles.logoText}>FuturesJournal</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#how-it-works">How It Works</a>
          <a href="#compare">Compare</a>
          <a href="#testimonials">Testimonials</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.btnGhost}>Log in</Link>
          <Link href="/signup" className={styles.btnPrimary}>Start Free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroBadge}>🔥 The #1 Journal for Futures Traders</div>
          <h1 className={styles.heroTitle}>
            Your trades are<br />
            trying to tell<br />
            <span className={styles.heroAccent}>you something.</span>
          </h1>
          <p className={styles.heroSub}>
            FuturesJournal turns your raw trade data into brutal, honest feedback.
            Find your edge. Kill your mistakes. Trade with conviction.
          </p>
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.btnHero}>Start For Free →</Link>
            <Link href="#how-it-works" className={styles.btnGhost}>See How It Works</Link>
          </div>
        </div>

        {/* Animated Dashboard Preview */}
        <div className={styles.heroRight}>
          <div className={styles.dashPreview}>
            <div className={styles.dashHeader}>
              <span className={styles.dashTitle}>Dashboard</span>
              <span className={styles.dashDate}>Today</span>
            </div>
            <div className={styles.dashStats}>
              <div className={styles.dashStat}>
                <span className={styles.dashStatLabel}>P&L Today</span>
                <span className={`${styles.dashStatValue} ${styles.green}`}>+$1,247.50</span>
              </div>
              <div className={styles.dashStat}>
                <span className={styles.dashStatLabel}>Win Rate</span>
                <span className={`${styles.dashStatValue} ${styles.green}`}>72%</span>
              </div>
              <div className={styles.dashStat}>
                <span className={styles.dashStatLabel}>Profit Factor</span>
                <span className={styles.dashStatValue}>2.4</span>
              </div>
            </div>
            <div className={styles.dashChart}>
              {[40, 55, 45, 60, 50, 75, 65, 80, 70, 88, 78, 95].map((h, i) => (
                <div key={i} className={styles.dashBar} style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
            <div className={styles.dashTrades}>
              {[
                { inst: 'ES', dir: 'LONG', pnl: '+$312.50', win: true },
                { inst: 'NQ', dir: 'SHORT', pnl: '-$145.00', win: false },
                { inst: 'MNQ', dir: 'LONG', pnl: '+$87.50', win: true },
                { inst: 'ES', dir: 'LONG', pnl: '+$625.00', win: true },
              ].map((t, i) => (
                <div key={i} className={styles.dashTradeRow} style={{ animationDelay: `${i * 0.12}s` }}>
                  <span className={styles.dashInst}>{t.inst}</span>
                  <span className={`${styles.dashDir} ${t.dir === 'LONG' ? styles.long : styles.short}`}>{t.dir}</span>
                  <span className={t.win ? styles.green : styles.red}>{t.pnl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BIG STATS */}
      <section className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>47,200+</span>
          <span className={styles.statDesc}>Trades Logged</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNum}>$2.4M+</span>
          <span className={styles.statDesc}>P&L Tracked</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNum}>1,800+</span>
          <span className={styles.statDesc}>Active Traders</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNum}>94%</span>
          <span className={styles.statDesc}>Find Their Edge</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.howItWorks} id="how-it-works">
        <div className={styles.sectionTag}>HOW IT WORKS</div>
        <h2 className={styles.sectionTitle}>From trade to insight<br />in seconds.</h2>
        <div className={styles.steps}>
          {[
            { num: '01', title: 'Log or Import', desc: 'Enter trades manually in seconds or import directly from Tradovate with one click. Every fill, every timestamp, automatically captured.' },
            { num: '02', title: 'Tag & Reflect', desc: 'Tag your setup, mark your mistakes, rate your execution. Takes 30 seconds. Builds a data set that will change how you trade.' },
            { num: '03', title: 'Find Your Edge', desc: 'Analytics break down your performance by setup, instrument, day of week, and more. See exactly where your money comes from — and where it leaks.' },
            { num: '04', title: 'Trade Better', desc: 'Build your playbook from what actually works. Set risk rules that protect you on bad days. Show up every session with a plan.' },
          ].map((s, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNum}>{s.num}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES SHOWCASE */}
      <section className={styles.features}>
        <div className={styles.sectionTag}>FEATURES</div>
        <h2 className={styles.sectionTitle}>Built for the way<br />traders actually think.</h2>
        <div className={styles.featureGrid}>
          {[
            { icon: '📊', title: 'Deep Analytics', desc: 'Win rate, profit factor, expectancy, MAE/MFE, performance by day — 20+ metrics that reveal the truth about your trading.' },
            { icon: '📋', title: 'Playbook Builder', desc: 'Document your setups with entry rules, exit criteria, and ideal conditions. Every trade links back to your playbook automatically.' },
            { icon: '🛡️', title: 'Risk Rules Engine', desc: 'Set daily loss limits, max contracts, and trade caps. Hit your limit and the app locks you out. No more revenge trading.' },
            { icon: '📥', title: 'Tradovate Import', desc: 'Export your performance CSV from Tradovate and import 100 trades in one click. No manual entry. No mistakes.' },
            { icon: '⚠️', title: 'Mistake Tracker', desc: 'Tag every losing trade with a mistake type. See exactly how much FOMO, revenge trading, and chasing has cost you in dollars.' },
            { icon: '📈', title: 'Equity Curve', desc: 'Watch your account grow trade by trade. Spot the streaks, the drawdowns, and the turning points in your development.' },
          ].map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className={styles.compare} id="compare">
        <div className={styles.sectionTag}>COMPARISON</div>
        <h2 className={styles.sectionTitle}>Why traders switch<br />to FuturesJournal.</h2>
        <div className={styles.compareTable}>
          <div className={styles.compareHeader}>
            <div className={styles.compareFeatureCol}>Feature</div>
            <div className={`${styles.compareCol} ${styles.compareColUs}`}>FuturesJournal</div>
            <div className={styles.compareCol}>Tradervue</div>
            <div className={styles.compareCol}>Tradezella</div>
            <div className={styles.compareCol}>Spreadsheet</div>
          </div>
          {[
            ['Futures-first design', true, false, false, false],
            ['Tradovate CSV import', true, false, true, false],
            ['Playbook builder', true, false, true, false],
            ['Risk rules & lockout', true, false, false, false],
            ['Mistake cost analysis', true, false, false, false],
            ['Auto P&L calculation', true, true, true, false],
            ['Performance by setup', true, true, true, false],
            ['Free tier available', true, true, true, true],
          ].map(([feature, us, tv, tz, ss], i) => (
            <div key={i} className={`${styles.compareRow} ${i % 2 === 0 ? styles.compareRowAlt : ''}`}>
              <div className={styles.compareFeatureCol}>{feature as string}</div>
              <div className={`${styles.compareCol} ${styles.compareColUs}`}>
                {us ? <span className={styles.checkYes}>✓</span> : <span className={styles.checkNo}>✗</span>}
              </div>
              <div className={styles.compareCol}>
                {tv ? <span className={styles.checkYes}>✓</span> : <span className={styles.checkNo}>✗</span>}
              </div>
              <div className={styles.compareCol}>
                {tz ? <span className={styles.checkYes}>✓</span> : <span className={styles.checkNo}>✗</span>}
              </div>
              <div className={styles.compareCol}>
                {ss ? <span className={styles.checkYes}>✓</span> : <span className={styles.checkNo}>✗</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={styles.testimonials} id="testimonials">
        <div className={styles.sectionTag}>TESTIMONIALS</div>
        <h2 className={styles.sectionTitle}>Traders who stopped<br />guessing.</h2>
        <div className={styles.testimonialsGrid}>
          {[
            { name: 'Marcus R.', handle: '@marcusfutures', text: 'I went from blowing up every Friday to actually having a consistent edge. Turns out I was revenge trading after 2 losses every single time. FuturesJournal showed me that in the first week.', pnl: '+$4,200 last month' },
            { name: 'Sarah K.', handle: '@sk_trader', text: 'The playbook builder changed everything. I used to trade by feel. Now every trade has a reason and I can actually measure which setups work.', pnl: 'Passed 2 prop firm challenges' },
            { name: 'Devon T.', handle: '@devontrades', text: 'Imported 3 months of Tradovate data in 30 seconds. The analytics immediately showed me that I make all my money on ES between 9:30 and 10:15. Changed my whole schedule.', pnl: '67% → 74% win rate' },
            { name: 'James L.', handle: '@jltrading', text: 'The risk rules feature alone is worth it. I set a $500 daily loss limit and it holds me accountable. Haven\'t blown a day account since I started using it.', pnl: '0 blown accounts in 90 days' },
            { name: 'Priya M.', handle: '@priyafutures', text: 'I tried Tradervue and Tradezella. Neither was built for futures. FuturesJournal actually understands tick values, sessions, and how futures traders think.', pnl: 'Best tool I\'ve used in 4 years' },
            { name: 'Carlos V.', handle: '@cvtrader', text: 'The mistake tracker is brutal but necessary. Seeing $2,400 next to "FOMO" in one month was the wake up call I needed. That number is now $0.', pnl: 'Eliminated FOMO trades entirely' },
          ].map((t, i) => (
            <div key={i} className={styles.testimonialCard}>
              <p className={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
              <div className={styles.testimonialFooter}>
                <div className={styles.testimonialAvatar}>{t.name[0]}</div>
                <div className={styles.testimonialInfo}>
                  <span className={styles.testimonialName}>{t.name}</span>
                  <span className={styles.testimonialHandle}>{t.handle}</span>
                </div>
                <div className={styles.testimonialPnl}>{t.pnl}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionTag}>PRICING</div>
        <h2 className={styles.sectionTitle}>Start free.<br />Upgrade when ready.</h2>
        <div className={styles.pricingGrid}>
          <div className={styles.pricingCard}>
            <h3 className={styles.planName}>Free</h3>
            <div className={styles.planPrice}>$0<span>/mo</span></div>
            <ul className={styles.planFeatures}>
              <li>✓ 50 trades per month</li>
              <li>✓ Basic analytics</li>
              <li>✓ Manual trade entry</li>
              <li>✓ Playbook (3 setups)</li>
              <li className={styles.planNo}>✗ AI coaching</li>
              <li className={styles.planNo}>✗ CSV import</li>
              <li className={styles.planNo}>✗ Risk rules engine</li>
            </ul>
            <Link href="/signup" className={styles.btnGhost}>Get Started Free</Link>
          </div>
          <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
            <div className={styles.featuredBadge}>MOST POPULAR</div>
            <h3 className={styles.planName}>Pro</h3>
            <div className={styles.planPrice}>$29<span>/mo</span></div>
            <ul className={styles.planFeatures}>
              <li>✓ Unlimited trades</li>
              <li>✓ Full analytics suite</li>
              <li>✓ CSV import (Tradovate)</li>
              <li>✓ Risk rules engine</li>
              <li>✓ Unlimited playbook</li>
              <li>✓ Mistake cost analysis</li>
              <li>✓ Priority support</li>
            </ul>
            <Link href="/signup" className={styles.btnPrimary}>Start Free Trial</Link>
          </div>
          <div className={styles.pricingCard}>
            <h3 className={styles.planName}>Team</h3>
            <div className={styles.planPrice}>$79<span>/mo</span></div>
            <ul className={styles.planFeatures}>
              <li>✓ Everything in Pro</li>
              <li>✓ Up to 10 traders</li>
              <li>✓ Mentor dashboard</li>
              <li>✓ Prop firm mode</li>
              <li>✓ Team analytics</li>
              <li>✓ Shared playbooks</li>
              <li>✓ Dedicated support</li>
            </ul>
            <Link href="/signup" className={styles.btnGhost}>Contact Us</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Your next 100 trades<br />will define your career.</h2>
        <p className={styles.ctaSub}>Start journaling them properly. Free forever, no card needed.</p>
        <Link href="/signup" className={styles.btnHero}>Create Your Free Account →</Link>
      </section>

      {/* DISCLAIMER */}
      <section className={styles.disclaimer}>
        <div className={styles.disclaimerInner}>
          <p className={styles.disclaimerTitle}>⚠️ Important Disclaimer</p>
          <p className={styles.disclaimerText}>
            FuturesJournal is a trade journaling and performance tracking tool only. It is not a financial advisor, broker, or investment platform. Nothing on this website or within the application constitutes financial advice, investment advice, trading advice, or any other kind of advice. All content is for informational and educational purposes only.
          </p>
          <p className={styles.disclaimerText}>
            Futures trading involves substantial risk of loss and is not appropriate for all investors. Past performance — whether your own historical trades or any results mentioned on this site — is not indicative of future results. You should never trade with money you cannot afford to lose. Always consult a qualified financial professional before making any trading decisions.
          </p>
          <p className={styles.disclaimerText}>
            The testimonials, stats, and results shown on this website are for illustrative purposes only and do not represent guaranteed or typical outcomes. Individual results will vary based on market conditions, trading skill, risk management, and other factors entirely outside our control.
          </p>
          <p className={styles.disclaimerText}>
            By using FuturesJournal, you acknowledge that you are solely responsible for your own trading decisions and any financial outcomes that result from them. FuturesJournal and its creators accept no liability for any losses incurred through the use of this platform.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerLogo}>
            <span className={styles.logoIcon}>◈</span>
            <span className={styles.logoText}>FuturesJournal</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#how-it-works">How It Works</a>
            <a href="#compare">Compare</a>
            <a href="#pricing">Pricing</a>
            <a href="/login">Log In</a>
            <a href="/signup">Sign Up</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p className={styles.footerCopy}>© 2026 FuturesJournal. All rights reserved.</p>
          <p className={styles.footerCopy}>Not financial advice. Trade at your own risk.</p>
        </div>
      </footer>

    </main>
  )
}