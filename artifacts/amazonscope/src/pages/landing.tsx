import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  Database,
  Eye,
  Gauge,
  Layers3,
  LineChart,
  Menu,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react';
import { Link } from 'wouter';

const revealClass = 'landing-reveal';

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('is-visible');
        observer.unobserve(element);
      }
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Mark({ light = false }: { light?: boolean }) {
  return <Link href="/" className="landing-mark" data-testid="link-marketing-logo">
    <span className={light ? 'landing-mark-icon landing-mark-icon-light' : 'landing-mark-icon'}><LineChart size={19} strokeWidth={2.6} /></span>
    <span className={light ? 'landing-mark-word landing-mark-word-light' : 'landing-mark-word'}>AMAZON<span>SCOPE</span></span>
  </Link>;
}

function SignalChart() {
  return <div className="signal-chart" data-testid="display-signal-chart" aria-label="Category demand signal chart">
    <div className="signal-chart-grid" />
    <svg viewBox="0 0 560 180" role="img" aria-label="Rising category demand over twelve weeks">
      <defs>
        <linearGradient id="signalArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f49a3b" stopOpacity=".28" />
          <stop offset="1" stopColor="#f49a3b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 158 C48 154 53 136 91 140 S145 119 182 127 S235 101 270 108 S316 88 350 93 S405 61 439 71 S493 31 560 18 V180 H0Z" fill="url(#signalArea)" />
      <path d="M0 158 C48 154 53 136 91 140 S145 119 182 127 S235 101 270 108 S316 88 350 93 S405 61 439 71 S493 31 560 18" fill="none" stroke="#f49a3b" strokeWidth="4" strokeLinecap="round" />
      <circle cx="439" cy="71" r="5" fill="#f8f1e4" stroke="#f49a3b" strokeWidth="3" />
      <circle cx="560" cy="18" r="5" fill="#f8f1e4" stroke="#f49a3b" strokeWidth="3" />
    </svg>
    <div className="signal-chart-labels"><span>W1</span><span>W4</span><span>W8</span><span>W12</span></div>
  </div>;
}

function CommandVisual() {
  return <div className="command-visual" data-testid="display-command-center">
    <div className="command-window-bar"><span className="window-dots"><i /><i /><i /></span><span className="window-path">amazonScope / signal room</span><span className="window-live"><span />LIVE</span></div>
    <div className="command-window-body">
      <div className="command-sidebar">
        <span className="command-sidebar-brand">AS</span>
        <span className="command-sidebar-line active"><Gauge size={14} /></span>
        <span className="command-sidebar-line"><Layers3 size={14} /></span>
        <span className="command-sidebar-line"><UsersRound size={14} /></span>
        <span className="command-sidebar-line"><Eye size={14} /></span>
      </div>
      <div className="command-main">
        <div className="command-heading"><div><span className="command-kicker">CATEGORY SIGNAL</span><h3>Portable power</h3></div><span className="command-time">Updated 4m ago</span></div>
        <div className="command-metrics">
          <div><span>Demand index</span><strong>84.6</strong><em className="up"><ArrowUpRight size={12} /> 12.8%</em></div>
          <div><span>Median price</span><strong>$68.40</strong><em className="down">↓ 3.2%</em></div>
          <div><span>Review velocity</span><strong>+18.4k</strong><em className="up"><ArrowUpRight size={12} /> 8.1%</em></div>
        </div>
        <SignalChart />
        <div className="command-bottom"><div><span className="mini-label">WATCHLIST</span><p>Anker 737 Power Bank <b>Rising</b></p></div><span className="mini-score">91 / 100</span></div>
      </div>
    </div>
  </div>;
}

function SignalCard({ icon: Icon, eyebrow, title, body, stat, accent = 'cyan' }: { icon: typeof Search; eyebrow: string; title: string; body: string; stat: string; accent?: 'cyan' | 'orange' | 'navy' }) {
  return <article className={`signal-card signal-card-${accent}`} data-testid={`card-signal-${eyebrow.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="signal-card-top"><span className="signal-card-icon"><Icon size={18} /></span><span className="signal-card-stat">{stat}</span></div>
    <span className="eyebrow">{eyebrow}</span>
    <h3>{title}</h3>
    <p>{body}</p>
    <ArrowUpRight className="signal-card-arrow" size={18} />
  </article>;
}

function LandingNav() {
  const [open, setOpen] = useState(false);
  return <header className="landing-nav">
    <div className="landing-nav-inner">
      <Mark />
      <nav className={open ? 'landing-nav-links is-open' : 'landing-nav-links'} aria-label="Marketing navigation">
        <a href="#signals" onClick={() => setOpen(false)} data-testid="link-nav-signals">Signals</a>
        <a href="#workflow" onClick={() => setOpen(false)} data-testid="link-nav-workflow">How it works</a>
        <a href="#operators" onClick={() => setOpen(false)} data-testid="link-nav-operators">For operators</a>
        <Link href="/pricing" onClick={() => setOpen(false)} data-testid="link-nav-pricing-marketing">Pricing</Link>
        <div className="landing-mobile-cta"><Link href="/overview" onClick={() => setOpen(false)} data-testid="link-mobile-workspace">Open workspace <ArrowRight size={15} /></Link></div>
      </nav>
      <div className="landing-nav-actions">
        <Link href="/overview" className="landing-nav-login" data-testid="link-nav-workspace">Sign in</Link>
        <Link href="/checker" className="button button-small button-dark" data-testid="link-nav-start">Start researching <ArrowRight size={15} /></Link>
      </div>
      <button className="landing-mobile-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} data-testid="button-mobile-navigation">{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
  </header>;
}

function LandingPage() {
  const heroRef = useReveal();
  const signalRef = useReveal();
  const workflowRef = useReveal();
  const operatorRef = useReveal();
  return <div className="landing-page">
    <LandingNav />
    <main>
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-container landing-hero-grid">
          <div ref={heroRef} className={revealClass}>
            <div className="eyebrow eyebrow-light"><span className="eyebrow-pulse" />Amazon marketplace intelligence</div>
            <h1>Make the next<br /><span>smart move.</span></h1>
            <p className="landing-hero-copy">AmazonScope turns live product, seller, pricing, review, category, and influencer signals into decisions you can defend.</p>
            <div className="landing-hero-actions">
              <Link href="/checker" className="button button-orange" data-testid="link-hero-checker">Check a product <ArrowRight size={17} /></Link>
              <Link href="/overview" className="button button-quiet" data-testid="link-hero-overview">Explore the workspace <ArrowUpRight size={16} /></Link>
            </div>
            <div className="landing-hero-trust"><ShieldCheck size={15} /><span>Built for operators who need the signal, not another dashboard.</span></div>
          </div>
          <div className="hero-visual-wrap" data-testid="visual-hero-command">
            <div className="hero-visual-caption"><span className="status-dot" /> Live signal room <span>Refreshed every 4 minutes</span></div>
            <CommandVisual />
            <div className="hero-float-card hero-float-top"><span className="float-icon"><TrendingUp size={15} /></span><span><b>Rising faster</b><small>Portable power · +12.8%</small></span></div>
            <div className="hero-float-card hero-float-bottom"><span className="float-icon orange"><Star size={15} fill="currentColor" /></span><span><b>Review gap found</b><small>3 buyer needs competitors miss</small></span></div>
          </div>
        </div>
        <div className="landing-container hero-bottomline"><span>One workspace for the questions behind every move.</span><div className="scroll-cue"><span /> Scroll to explore</div></div>
      </section>

      <section className="proof-strip">
        <div className="landing-container proof-inner"><span className="proof-label">One source of signal across</span><span>Product research</span><i /><span>Competitive tracking</span><i /><span>Category strategy</span><i /><span>Creator intelligence</span></div>
      </section>

      <section id="signals" className="landing-section landing-section-paper">
        <div ref={signalRef} className={`${revealClass} landing-container`}>
          <div className="section-intro section-intro-split"><div><span className="eyebrow">See around corners</span><h2>Everything that moves<br /><em>leaves a trace.</em></h2></div><p>Stop stitching together tabs, exports, and gut feel. AmazonScope brings the market’s quiet changes into one clear view, with context attached.</p></div>
          <div className="signal-grid">
            <SignalCard icon={Search} eyebrow="Product signals" title="Know what deserves a closer look." body="Move from an ASIN to the full story: pricing, rank, reviews, sellers, and momentum in one scan." stat="01" />
            <SignalCard icon={UsersRound} eyebrow="Seller movement" title="See who is taking ground." body="Track the operators behind the offer. Spot new entrants, price pressure, and durable advantage early." stat="02" accent="orange" />
            <SignalCard icon={BarChart3} eyebrow="Category pulse" title="Find the room before it closes." body="Compare demand, review velocity, and price bands across categories that matter to your next decision." stat="03" accent="navy" />
          </div>
          <div className="signal-footnote"><Database size={15} /><span>Live marketplace data, made legible.</span><Link href="/api-status" data-testid="link-signals-api-status">View data status <ArrowRight size={14} /></Link></div>
        </div>
      </section>

      <section id="workflow" className="landing-section landing-section-dark">
        <div ref={workflowRef} className={`${revealClass} landing-container`}>
          <div className="section-intro section-intro-light"><span className="eyebrow eyebrow-light">A calmer research loop</span><h2>From question<br /><em>to conviction.</em></h2><p>Good intelligence does not add noise. It shortens the distance between “interesting” and “we should act.”</p></div>
          <div className="workflow-steps">
            <div className="workflow-step"><span className="workflow-number">01</span><Search size={22} /><h3>Ask a sharper question</h3><p>Start with an ASIN, a category, a seller, or the market shift you cannot explain.</p><span className="workflow-rule" /></div>
            <div className="workflow-step"><span className="workflow-number">02</span><LineChart size={22} /><h3>Read the signal stack</h3><p>See the changes that matter together, with the surrounding context never more than a click away.</p><span className="workflow-rule" /></div>
            <div className="workflow-step"><span className="workflow-number">03</span><Check size={22} /><h3>Decide with receipts</h3><p>Save the products, moments, and evidence your team will need when the decision comes back around.</p><span className="workflow-rule" /></div>
          </div>
          <div className="workflow-callout"><span>Built for the five-minute question and the five-quarter bet.</span><Link href="/overview" data-testid="link-workflow-overview">Open the workspace <ArrowRight size={15} /></Link></div>
        </div>
      </section>

      <section className="landing-section landing-section-warm">
        <div className="landing-container insight-grid">
          <div className="insight-copy"><span className="eyebrow">Intelligence with a point of view</span><h2>Numbers are only useful when they change the <em>question.</em></h2><p>AmazonScope gives operators the confidence to go one level deeper. Not a louder feed. A better starting point.</p><Link href="/checker" className="text-link" data-testid="link-insight-checker">Run your first check <ArrowRight size={15} /></Link></div>
          <div className="insight-notes">
            <div className="insight-note"><span className="note-index">A</span><div><span className="note-label">Pricing signal</span><h3>The discount is not the story.</h3><p>See how often a product is promoted, who follows, and whether the new price is actually new.</p></div><ArrowUpRight size={17} /></div>
            <div className="insight-note"><span className="note-index">B</span><div><span className="note-label">Review signal</span><h3>Volume hides the useful part.</h3><p>Find recurring buyer friction and the needs your category has learned to ignore.</p></div><ArrowUpRight size={17} /></div>
            <div className="insight-note"><span className="note-index">C</span><div><span className="note-label">Creator signal</span><h3>Attention has a pattern.</h3><p>Follow the products moving through creator conversations before the category rank catches up.</p></div><ArrowUpRight size={17} /></div>
          </div>
        </div>
      </section>

      <section id="operators" className="landing-section landing-section-paper operator-section">
        <div ref={operatorRef} className={`${revealClass} landing-container`}>
          <div className="operator-top"><div><span className="eyebrow">For people close to the decision</span><h2>Less reporting.<br /><em>More signal.</em></h2></div><p>Whether you are building the next product, managing a portfolio, or hunting for the whitespace competitors missed, AmazonScope keeps your attention where the market is moving.</p></div>
          <div className="operator-quote"><div className="quote-mark">“</div><blockquote>We do not need more data. We need to know which data deserves a meeting.</blockquote><div className="quote-source"><span className="quote-avatar">MC</span><span><b>Marcus Chen</b><small>Category lead, consumer electronics</small></span></div></div>
          <div className="operator-metrics"><div><strong>4.2<span>×</span></strong><small>faster first-pass research</small></div><div><strong>7<span>+</span></strong><small>signal layers in one view</small></div><div><strong>1</strong><small>calm place to make the call</small></div></div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-grid" />
        <div className="landing-container landing-cta-inner"><span className="eyebrow eyebrow-light">The market will keep moving.</span><h2>Make your next move<br /><em>with the full picture.</em></h2><p>Start with one product. Leave with a clearer point of view.</p><div className="landing-hero-actions"><Link href="/checker" className="button button-orange" data-testid="link-cta-checker">Check a product <ArrowRight size={17} /></Link><Link href="/overview" className="button button-quiet" data-testid="link-cta-overview">Open AmazonScope <ArrowUpRight size={16} /></Link></div></div>
      </section>
    </main>
    <footer className="landing-footer"><div className="landing-container footer-top"><Mark light /><div className="footer-links"><div><span>Product</span><Link href="/checker" data-testid="link-footer-checker">ASIN checker</Link><Link href="/categories" data-testid="link-footer-categories">Categories</Link><Link href="/sellers" data-testid="link-footer-sellers">Seller intelligence</Link></div><div><span>Explore</span><Link href="/blog" data-testid="link-footer-blog">Market notes</Link><Link href="/pricing" data-testid="link-footer-pricing">Plans & usage</Link><Link href="/contact" data-testid="link-footer-contact">Contact</Link></div><div><span>Workspace</span><Link href="/overview" data-testid="link-footer-overview">Open workspace</Link><Link href="/api-status" data-testid="link-footer-api-status">API status</Link></div></div></div><div className="landing-container footer-bottom"><span>© 2025 AmazonScope. Marketplace intelligence for people who move first.</span><span className="footer-status"><span />Live data systems operational</span></div></footer>
  </div>;
}

export default LandingPage;