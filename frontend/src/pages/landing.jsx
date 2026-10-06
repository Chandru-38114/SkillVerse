import { Link } from 'react-router-dom'
import { getSessionUser } from '../api'
import { HeroIllustration, EmptyStateIllustration } from '../components/illustrations'
import { Reveal, StaggerContainer, StaggerItem } from '../components/animations'
import { GradientOrb, DecorativeGrid } from '../components/visuals'
import { ArrowRight, BookOpen, Compass, Users, Star, Brain, Shield, Rocket } from 'lucide-react'

export default function Landing() {
  const user = getSessionUser()

  return (
    <div className="min-h-screen bg-paper font-body text-ink relative overflow-hidden">
      <DecorativeGrid className="opacity-30" />
      <GradientOrb color="bg-brand" size="w-[600px] h-[600px]" className="-top-40 -left-20" opacity="opacity-10" />
      <GradientOrb color="bg-brand2" size="w-[800px] h-[800px]" className="top-80 -right-60" opacity="opacity-[0.08]" blur="blur-[140px]" />

      {/* ── HERO ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
        <div className="flex-1 text-center lg:text-left">
          <Reveal duration={0.8} yOffset={30}>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand font-bold text-xs uppercase tracking-wider mb-6">
              <Star className="w-3.5 h-3.5" />
              The Peer-to-Peer Learning Network
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-ink mb-6 leading-[1.1] tracking-tight">
              Learn from people.<br className="hidden md:block" />
              <span className="text-clay">Share what you know.</span><br />
              Grow together.
            </h1>
            <p className="text-lg md:text-xl text-clay font-medium max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              SkillVerse is a community where knowledge is exchanged, not bought. Connect with peers, teach your strengths, and master new skills together.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="btn-primary py-3.5 px-8 text-base shadow-lg shadow-brand/20 w-full sm:w-auto">
                    Go to Dashboard
                  </Link>
                  <Link to="/marketplace" className="btn-secondary py-3.5 px-8 text-base w-full sm:w-auto">
                    Browse Skills
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/signup" className="btn-primary py-3.5 px-8 text-base shadow-lg shadow-brand/20 w-full sm:w-auto flex items-center justify-center gap-2">
                    Join SkillVerse <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/login" className="btn-secondary py-3.5 px-8 text-base w-full sm:w-auto">
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </Reveal>
        </div>
        <div className="flex-1 w-full max-w-lg lg:max-w-none flex justify-center relative">
          <Reveal duration={1} delay={0.2} yOffset={20}>
            <div className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-square flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent rounded-full blur-3xl"></div>
              <HeroIllustration className="w-[110%] relative z-10 drop-shadow-2xl" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative z-10 bg-surface border-y border-line py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-4">How it works</h2>
            <p className="text-clay text-lg">A simple cycle of continuous growth and collaboration.</p>
          </div>
          
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StepCard 
              num="01" 
              title="Assess" 
              desc="Establish your baseline skill level with an objective challenge." 
              icon={<Brain className="w-6 h-6 text-brand" />} 
            />
            <StepCard 
              num="02" 
              title="Discover" 
              desc="Find peers who want to learn what you know, or teach what you need." 
              icon={<Compass className="w-6 h-6 text-brand2" />} 
            />
            <StepCard 
              num="03" 
              title="Connect" 
              desc="Schedule sessions and collaborate in our interactive learning rooms." 
              icon={<Users className="w-6 h-6 text-gold" />} 
            />
            <StepCard 
              num="04" 
              title="Grow" 
              desc="Earn verified badges as you master skills and mentor others." 
              icon={<Shield className="w-6 h-6 text-brand" />} 
            />
          </StaggerContainer>
        </div>
      </section>

      {/* ── WHY SKILLVERSE ── */}
      <section className="relative z-10 py-24 max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 w-full flex justify-center order-2 lg:order-1">
             <Reveal duration={0.8} yOffset={30}>
               <div className="card p-10 bg-lift/50 border-none shadow-xl shadow-brand/5 w-full max-w-md mx-auto">
                 <EmptyStateIllustration message="Connection drives mastery" secondaryMessage="Learning in isolation is slow. Learning together is exponential." />
               </div>
             </Reveal>
          </div>
          <div className="flex-1 order-1 lg:order-2">
            <Reveal duration={0.8}>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-6">Why learn with peers?</h2>
              <div className="space-y-8">
                <FeatureItem title="Teach your strengths" desc="Solidify your own knowledge by guiding someone else through the concepts you already know." />
                <FeatureItem title="Learn from practitioners" desc="Get practical insights from peers who are actively using the skills you want to learn." />
                <FeatureItem title="Build meaningful connections" desc="Expand your network with motivated individuals who share your drive for continuous improvement." />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── EXPLORE SKILLS ── */}
      <section className="relative z-10 bg-lift/30 border-t border-line py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-4">Explore a universe of skills</h2>
            <p className="text-clay text-lg">Whatever you want to learn, there's someone ready to teach it.</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {['React', 'Python', 'Data Science', 'Machine Learning', 'Figma', 'UI/UX Design', 'JavaScript', 'System Architecture', 'Public Speaking', 'Go'].map((skill, i) => (
              <Reveal key={skill} duration={0.5} delay={i * 0.05} yOffset={10}>
                <div className="px-6 py-3 bg-surface border border-line rounded-xl text-ink font-semibold shadow-sm hover:shadow-md hover:border-brand/30 transition-all cursor-default">
                  {skill}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-32 text-center px-6">
        <Reveal duration={0.8} yOffset={20}>
          <Rocket className="w-12 h-12 text-brand mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-display font-bold text-ink mb-6">Ready to start your journey?</h2>
          <p className="text-clay text-xl mb-10 max-w-2xl mx-auto">
            Join the community today. Take your first skill challenge and connect with a learning partner in minutes.
          </p>
          {!user && (
            <Link to="/signup" className="btn-primary py-4 px-10 text-lg shadow-xl shadow-brand/20">
              Create your free profile
            </Link>
          )}
        </Reveal>
      </section>
    </div>
  )
}

function StepCard({ num, title, desc, icon }) {
  return (
    <StaggerItem>
      <div className="card h-full border border-line/60 bg-surface/80 hover:bg-surface hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-xl bg-lift flex items-center justify-center">
            {icon}
          </div>
          <span className="text-3xl font-display font-bold text-line">{num}</span>
        </div>
        <h3 className="text-xl font-bold text-ink mb-3">{title}</h3>
        <p className="text-clay leading-relaxed">{desc}</p>
      </div>
    </StaggerItem>
  )
}

function FeatureItem({ title, desc }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 mt-1">
        <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-brand"></div>
        </div>
      </div>
      <div>
        <h4 className="text-xl font-bold text-ink mb-2">{title}</h4>
        <p className="text-clay leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}