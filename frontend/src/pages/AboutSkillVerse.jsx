import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AboutSkillVerse() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      {/* Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-ink/70 hover:text-brand transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        
        {/* HERO SECTION */}
        <section className="mt-8 mb-20 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-ink mb-4">
            SkillVerse
          </h1>
          <h2 className="text-2xl md:text-3xl font-medium text-ink/80 mb-8">
            Better Skills. A Brighter Future.
          </h2>
          <p className="text-xl md:text-2xl font-light text-brand mb-12 max-w-2xl mx-auto">
            "Learning is better when you learn with people."
          </p>
          <div className="rounded-2xl overflow-hidden shadow-xl mb-12 bg-white">
            <img 
              src="/assets/hero-learning.png" 
              alt="People learning together"
              className="w-full h-[400px] md:h-[500px] object-cover object-center"
            />
          </div>
          <p className="text-lg md:text-xl text-ink/80 max-w-3xl mx-auto leading-relaxed">
            SkillVerse is a peer-to-peer learning platform where people discover skills, connect with others, practice together, and turn learning into real progress.
          </p>
        </section>

        {/* DISCOVER YOUR SKILLS */}
        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-3xl font-heading font-bold mb-6 text-brand">Discover Your Skills</h2>
            <p className="text-lg text-ink/80 leading-relaxed">
              Start with what you want to learn. SkillVerse helps you explore skills, understand where you stand, and find the next step in your learning journey.
            </p>
          </div>
          <div className="order-1 md:order-2 rounded-2xl overflow-hidden shadow-lg bg-white">
            <img 
              src="/assets/discover-skills.png" 
              alt="Discovering skills"
              className="w-full h-[300px] object-cover object-center"
            />
          </div>
        </section>

        {/* LEARN WITH OTHERS */}
        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg bg-white">
            <img 
              src="/assets/learn-with-others.png" 
              alt="Learn with others"
              className="w-full h-[300px] object-cover object-center"
            />
          </div>
          <div>
            <h2 className="text-3xl font-heading font-bold mb-6 text-brand">Learn With Others</h2>
            <p className="text-lg text-ink/80 leading-relaxed">
              Learning becomes more meaningful when knowledge is shared. Connect with people who can teach what they know, learn from their experience, and grow together.
            </p>
          </div>
        </section>

        {/* PRACTICE AND BUILD MASTERY */}
        <section className="mb-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-3xl font-heading font-bold mb-6 text-brand">Practice and Build Mastery</h2>
            <p className="text-lg text-ink/80 leading-relaxed">
              Knowledge grows through practice. SkillVerse gives learners opportunities to apply what they learn, practice with others, complete learning sessions, and steadily develop mastery.
            </p>
          </div>
          <div className="order-1 md:order-2 rounded-2xl overflow-hidden shadow-lg bg-white">
            <img 
              src="/assets/practice-mastery.png" 
              alt="Hands-on practice"
              className="w-full h-[300px] object-cover object-center"
            />
          </div>
        </section>

        {/* LEARNING IS THE GAMEPLAY */}
        <section className="mb-24 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-heading font-bold mb-6 text-ink">Learning is the Gameplay</h2>
          <p className="text-lg text-ink/80 leading-relaxed mb-12">
            SkillVerse turns learning into an active journey. Assessments reveal where you are. Connections help you learn with others. Practice sessions turn knowledge into action. Teaching lets you share what you know. Each meaningful learning activity moves your journey forward.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 font-medium text-brand text-lg">
            <div className="w-full sm:w-auto px-6 py-3 bg-white rounded-full shadow-sm border border-brand/10 text-center">Discover</div>
            <div className="hidden sm:block text-brand/50">→</div>
            <div className="sm:hidden text-brand/50">↓</div>
            <div className="w-full sm:w-auto px-6 py-3 bg-white rounded-full shadow-sm border border-brand/10 text-center">Practice</div>
            <div className="hidden sm:block text-brand/50">→</div>
            <div className="sm:hidden text-brand/50">↓</div>
            <div className="w-full sm:w-auto px-6 py-3 bg-white rounded-full shadow-sm border border-brand/10 text-center">Develop</div>
            <div className="hidden sm:block text-brand/50">→</div>
            <div className="sm:hidden text-brand/50">↓</div>
            <div className="w-full sm:w-auto px-6 py-3 bg-white rounded-full shadow-sm border border-brand/10 text-center">Master</div>
          </div>
        </section>

        {/* FROM LEARNING TO VERIFIED MASTERY */}
        <section className="mb-24 max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-brand/5">
          <h2 className="text-3xl font-heading font-bold mb-6 text-ink text-center">From Learning to Verified Mastery</h2>
          <p className="text-lg text-ink/80 leading-relaxed text-center mb-10">
            SkillVerse is designed around progress that comes from actual learning activity. As learners develop their skills through assessment, practice, learning sessions, and continued progress, they can reach Mastery.
          </p>
          
          <div className="flex flex-col items-center justify-center space-y-4 font-medium text-ink">
            <div className="w-48 text-center py-4 bg-paper rounded-xl">Discover</div>
            <div className="text-brand/50">↓</div>
            <div className="w-48 text-center py-4 bg-paper rounded-xl">Practice</div>
            <div className="text-brand/50">↓</div>
            <div className="w-48 text-center py-4 bg-paper rounded-xl">Develop</div>
            <div className="text-brand/50">↓</div>
            <div className="w-48 text-center py-4 bg-brand text-white rounded-xl shadow-md">Master</div>
          </div>
        </section>

        {/* SKILLVERSE CERTIFICATES */}
        <section className="mb-24 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-heading font-bold mb-6 text-brand">SkillVerse Certificates</h2>
          <p className="text-lg text-ink/80 leading-relaxed">
            When a learner reaches verified Mastery in a skill, SkillVerse can issue a certificate recognizing that achievement. Each certificate includes a unique certificate ID and QR verification so its authenticity can be checked online.
          </p>
        </section>

        {/* FINAL BRAND SECTION */}
        <section className="text-center pt-12 border-t border-brand/10">
          <p className="text-xl md:text-2xl font-medium text-ink/90 mb-12 max-w-2xl mx-auto">
            "Learn with people. Practice with purpose. Build skills that move you forward."
          </p>
          <h2 className="text-4xl font-heading font-bold text-ink mb-3">
            SkillVerse
          </h2>
          <p className="text-xl text-brand">
            Better Skills. A Brighter Future.
          </p>
        </section>

      </main>
    </div>
  );
}
