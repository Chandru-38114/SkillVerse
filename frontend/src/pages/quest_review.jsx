import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import ReviewForm from '../components/connect/ReviewForm'
import { CheckCircle2, TrendingUp, Award, Star, BookOpen, Clock } from 'lucide-react'

export default function QuestReview() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const navigate = useNavigate()
  
  const [session, setSession] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewed, setReviewed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const s = await api.getSession(sessionId)
        setSession(s)
        
        // Fetch progress and find the matching skill
        const allProgress = await api.getMyProgress()
        const skillName = s.skill_name || s.skill
        const currentProgress = allProgress.find(p => p.skill_name === skillName)
        setProgress(currentProgress)
        
        // Check if a review already exists
        if (s.request_id) {
          const existingReview = await api.getMyReviewForRequest(s.request_id)
          if (existingReview) {
            setReviewed(true)
          }
        }
      } catch (err) {
        setError(err.message || "Failed to load session details")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [sessionId])

  const handleReviewSubmitted = async () => {
    setSubmitting(true)
    try {
      // Refresh progress to catch the +5 pts or any other backend updates
      const allProgress = await api.getMyProgress()
      const skillName = session.skill_name || session.skill
      const currentProgress = allProgress.find(p => p.skill_name === skillName)
      setProgress(currentProgress)
      setReviewed(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper h-[100dvh]">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper h-[100dvh] text-center">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p className="text-clay mb-6">{error || "Session not found"}</p>
        <Link to="/dashboard" className="btn-primary">Return to Dashboard</Link>
      </div>
    )
  }

  const isTutor = user?.id === session.tutor_id
  const peerName = isTutor ? session.learner_name : session.tutor_name
  const skillName = session.skill_name || session.skill

  return (
    <div className="page pb-12 animate-fade-in stagger-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Header Section */}
        <div className="text-center mb-10 animate-slide-up stagger-2">
          <div className="w-16 h-16 bg-moss/10 text-moss rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2 tracking-tight">Session Completed</h1>
          <p className="text-clay text-lg">Great work! You've completed your session for {skillName}.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          
          {/* Progress Impact Card */}
          <div className="card p-6 border border-line shadow-sm bg-surface animate-slide-up stagger-3 h-full">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-brand" />
              Skill Progress
            </h2>
            
            {progress ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-0.5">{progress.role}</p>
                    <h3 className="text-xl font-bold text-ink">{progress.skill_name}</h3>
                  </div>
                  <span className="text-sm font-bold text-brand bg-brand/10 px-2.5 py-1.5 rounded-md">
                    {progress.progress_percentage}%
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-clay font-medium capitalize">{progress.level}</span>
                  {progress.badge && (
                    <span className="inline-flex items-center gap-1 bg-goldLight text-gold px-1.5 py-0.5 rounded text-[10px] font-bold border border-gold/20">
                      <Award className="w-3 h-3" /> {progress.badge}
                    </span>
                  )}
                </div>
                
                <div className="w-full bg-line/50 rounded-full h-2 mb-4 overflow-hidden relative">
                  <div 
                    className="bg-brand h-full rounded-full transition-all duration-700 ease-out animate-progress" 
                    style={{ width: `${Math.min(100, progress.progress_percentage)}%` }}
                  ></div>
                  {progress.progress_percentage === 100 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-brand flex items-center justify-center">
                      <Star className="w-2 h-2 text-brand" />
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-xs text-clay font-medium pt-4 border-t border-line/40">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-brand/70" /> {progress.sessions_completed || 0} sessions
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand/70" /> {Math.floor((progress.total_learning_minutes || 0) / 60)}h {(progress.total_learning_minutes || 0) % 60}m
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-clay text-sm text-center py-6">
                Progress data is syncing...
              </div>
            )}
          </div>

          {/* Review Card */}
          <div className="card p-6 border border-line shadow-sm bg-surface animate-slide-up stagger-4 h-full flex flex-col">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-gold" />
              Session Review
            </h2>
            
            <div className="flex-1 flex flex-col justify-center">
              {reviewed ? (
                <div className="bg-moss/10 border border-moss/20 rounded-xl p-6 text-center">
                  <div className="w-10 h-10 bg-moss/20 text-moss rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-moss font-semibold mb-2">Review Submitted</p>
                  <p className="text-moss/70 text-sm">Thank you for sharing your feedback. Your points have been awarded!</p>
                </div>
              ) : session.request_id ? (
                <ReviewForm 
                  requestId={session.request_id}
                  otherName={peerName}
                  onSubmitted={handleReviewSubmitted}
                />
              ) : (
                <div className="text-clay text-sm text-center py-6">
                  No review required for this session.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next Quest Call to Action */}
        <div className="mt-12 text-center animate-slide-up stagger-5">
          <p className="text-sm font-medium text-clay mb-4">Ready for your next challenge?</p>
          <Link 
            to="/dashboard" 
            className="btn-primary inline-flex text-base py-3 px-10 shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
          >
            Continue Skill Journey →
          </Link>
        </div>

      </div>
    </div>
  )
}
