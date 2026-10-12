import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import ReviewForm from '../components/connect/ReviewForm'
import {
  CheckCircle2, TrendingUp, Award, Star, BookOpen, Clock,
  Sparkles, ListChecks, ArrowRight, AlertCircle, RotateCcw, Target,
} from 'lucide-react'

const LOADING_MESSAGES = [
  "Reading your session notes",
  "Writing your questions",
  "Almost ready",
]

export default function QuestReview() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [progress, setProgress] = useState(null)
  const [sessionProgress, setSessionProgress] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewed, setReviewed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Knowledge check flow: intro -> loading -> quiz -> result -> review
  const [step, setStep] = useState('intro')
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const [quizSkipMessage, setQuizSkipMessage] = useState(null) // calm 409-on-start explanation
  const [quizError, setQuizError] = useState(null) // generic failure, retryable
  const [attemptId, setAttemptId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [quizSubmitting, setQuizSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [alreadySubmittedNotice, setAlreadySubmittedNotice] = useState(false)

  const loadingTimerRef = useRef(null)

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

        // Session summary for the "what you covered" intro card
        try {
          const sp = await api.getSessionProgress(sessionId)
          setSessionProgress(sp)
        } catch (spErr) {
          // No session progress recorded yet - the intro card just won't show a summary.
        }

        // Check if a review already exists for this session
        if (s.id) {
          try {
            const existingReview = await api.getMyReviewForSession(s.id)
            if (existingReview) {
              setReviewed(true)
            }
          } catch (reviewErr) {
            // It's expected for this to throw "No review found" if the user hasn't reviewed yet.
            if (reviewErr.message !== "No review found") {
              throw reviewErr;
            }
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

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current)
    }
  }, [])

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

  const startKnowledgeCheck = async () => {
    setQuizSkipMessage(null)
    setQuizError(null)
    setStep('loading')

    let messageIndex = 0
    setLoadingMessage(LOADING_MESSAGES[0])
    loadingTimerRef.current = setInterval(() => {
      messageIndex = Math.min(messageIndex + 1, LOADING_MESSAGES.length - 1)
      setLoadingMessage(LOADING_MESSAGES[messageIndex])
    }, 6000)

    try {
      const res = await api.startSessionQuiz(sessionId)
      setAttemptId(res.attempt_id)
      setQuestions(res.questions || [])
      setAnswers({})
      setStep('quiz')
    } catch (err) {
      clearInterval(loadingTimerRef.current)
      if (err.message && err.message.includes("wasn't enough recorded")) {
        setQuizSkipMessage(err.message)
        setStep('intro')
      } else {
        setQuizError(err.message || "Couldn't start the knowledge check.")
        setStep('intro')
      }
      return
    }
    clearInterval(loadingTimerRef.current)
  }

  const submitKnowledgeCheck = async () => {
    setQuizSubmitting(true)
    setQuizError(null)
    try {
      const payload = {
        attempt_id: attemptId,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
      }
      const res = await api.submitSessionQuiz(sessionId, payload)
      setResult(res)
      setStep('result')
    } catch (err) {
      if (err.message && err.message.includes("already been submitted")) {
        setAlreadySubmittedNotice(true)
        setStep('review')
      } else {
        setQuizError(err.message || "Couldn't submit the knowledge check.")
      }
    } finally {
      setQuizSubmitting(false)
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
  const answeredCount = Object.keys(answers).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  const showKnowledgeCheck = step !== 'review'

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

        {showKnowledgeCheck && (
          <div className="section-panel mb-8 animate-slide-up stagger-3">
            {step === 'intro' && (
              <div>
                {sessionProgress?.semantic_summary && (
                  <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-clay mb-2">What you covered</h2>
                    <p className="text-ink/80 leading-relaxed whitespace-pre-wrap">{sessionProgress.semantic_summary}</p>
                  </div>
                )}

                {quizSkipMessage && (
                  <div className="flex items-start gap-3 bg-paper border border-line rounded-xl p-4 mb-5">
                    <AlertCircle className="w-5 h-5 text-clay flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-clay">{quizSkipMessage}</p>
                  </div>
                )}

                {quizError && (
                  <div className="flex items-start gap-3 bg-paper border border-line rounded-xl p-4 mb-5">
                    <AlertCircle className="w-5 h-5 text-clay flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-clay">{quizError}</p>
                  </div>
                )}

                <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-brand/10 text-brandInk rounded-full flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-ink">Quick knowledge check</h3>
                      <p className="text-sm text-clay">5 questions on what you just learned.</p>
                    </div>
                  </div>
                  <button onClick={startKnowledgeCheck} className="btn-primary flex-shrink-0">
                    Start the check
                  </button>
                </div>
                <p className="text-xs text-clay mt-4 text-center">
                  This is practice - it does not change your verified skill level.
                </p>
              </div>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mb-5"></div>
                <p className="text-ink font-medium transition-all">{loadingMessage}...</p>
                <p className="text-xs text-clay mt-2">This usually takes 20-40 seconds.</p>
              </div>
            )}

            {step === 'quiz' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-brandInk" />
                    Knowledge check
                  </h2>
                  <span className="text-xs font-bold text-clay bg-paper px-2.5 py-1 rounded-full border border-line">
                    {answeredCount} of {questions.length} answered
                  </span>
                </div>

                {quizError && (
                  <div className="flex items-start gap-3 bg-paper border border-line rounded-xl p-4 mb-5">
                    <AlertCircle className="w-5 h-5 text-clay flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-clay">{quizError}</p>
                      <div className="flex gap-3 mt-3">
                        <button onClick={submitKnowledgeCheck} className="btn-secondary text-xs py-2 px-4">
                          <RotateCcw className="w-3.5 h-3.5" /> Retry
                        </button>
                        <button onClick={() => setStep('review')} className="text-xs text-clay underline">
                          Skip to review
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="card p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink/50 bg-ink/5 px-2.5 py-1 rounded-full">
                          Question {idx + 1}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-brandInk bg-brand/10 px-2.5 py-1 rounded-full">
                          {q.topic}
                        </span>
                      </div>
                      <p className="text-ink font-medium leading-relaxed mb-4 whitespace-pre-wrap">{q.question}</p>
                      <div className="space-y-2.5">
                        {(q.options || []).map((opt) => {
                          const isSelected = answers[q.id] === opt
                          return (
                            <label
                              key={opt}
                              className={`flex items-start gap-3 text-sm cursor-pointer px-4 py-3.5 rounded-xl border-2 transition-all duration-150
                                ${isSelected ? 'border-brand bg-brand/5 text-brandInk shadow-sm' : 'border-line hover:border-ink/20 hover:bg-paper'}`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                className="accent-brand mt-0.5"
                                checked={isSelected}
                                onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                              />
                              <span className={isSelected ? 'font-medium' : ''}>{opt}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={submitKnowledgeCheck}
                    disabled={!allAnswered || quizSubmitting}
                    className="btn-primary flex-1"
                  >
                    {quizSubmitting ? "Submitting..." : "Submit answers"}
                  </button>
                  <button onClick={() => setStep('review')} className="btn-secondary">
                    Skip to review
                  </button>
                </div>
              </div>
            )}

            {step === 'result' && result && (
              <div>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-brand/10 text-brandInk rounded-full flex items-center justify-center mx-auto mb-3">
                    <Target className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-wider text-clay mb-1">Your score</p>
                  <p className="text-4xl font-bold text-ink">{result.score}%</p>
                </div>

                {result.missed_topics && result.missed_topics.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-clay mb-2">Topics to revisit</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.missed_topics.map((t) => (
                        <span key={t} className="text-xs font-medium bg-paper border border-line text-ink/80 px-3 py-1.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.next_session_plan && result.next_session_plan.length > 0 && (
                  <div className="card p-5 bg-brand/5 border-brand/20">
                    <h3 className="font-bold text-ink flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-brandInk" />
                      Your next session should cover
                    </h3>
                    <ol className="space-y-3">
                      {result.next_session_plan.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-ink/90 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <button onClick={() => setStep('review')} className="btn-primary w-full mt-6">
                  Continue to review <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="animate-slide-up stagger-3">
            {alreadySubmittedNotice && (
              <div className="flex items-start gap-3 bg-paper border border-line rounded-xl p-4 mb-6">
                <CheckCircle2 className="w-5 h-5 text-moss flex-shrink-0 mt-0.5" />
                <p className="text-sm text-clay">You've already completed the knowledge check for this session.</p>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6 items-start">

            <div className="card-hover p-6 border border-line shadow-sm bg-surface h-full">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-brandInk" />
                Skill Progress
              </h2>

              {progress ? (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-brandInk uppercase tracking-wider mb-0.5">{progress.role}</p>
                      <h3 className="text-xl font-bold text-ink">{progress.skill_name}</h3>
                    </div>
                    <span className="text-sm font-bold text-brandInk bg-brand/10 px-2.5 py-1.5 rounded-md">
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
                        <Star className="w-2 h-2 text-brandInk" />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-xs text-clay font-medium pt-4 border-t border-line/40">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-brandInk/70" /> {progress.sessions_completed || 0} sessions
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brandInk/70" /> {Math.floor((progress.total_learning_minutes || 0) / 60)}h {(progress.total_learning_minutes || 0) % 60}m
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
            <div className="card p-6 border border-line shadow-sm bg-surface h-full flex flex-col">
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
                    sessionId={session.id}
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
          </div>
        )}

        {/* Next Quest Call to Action */}
        {step === 'review' && (
          <div className="mt-12 text-center animate-slide-up stagger-5">
            <p className="text-sm font-medium text-clay mb-4">Ready for your next challenge?</p>
            <Link
              to="/dashboard"
              className="btn-primary inline-flex text-base py-3 px-10 shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
            >
              Continue Skill Journey →
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
