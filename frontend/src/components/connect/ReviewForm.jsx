import { useState } from 'react'
import { api } from '../../api'

export default function ReviewForm({ requestId, otherName, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating === 0) { setFormError('Please select a star rating.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      await api.submitReview(requestId, { rating, comment })
      onSubmitted()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-sm font-medium text-ink/70 mb-3">
        Rate your session with <span className="text-ink font-semibold">{otherName}</span>
      </p>

      {/* Star picker */}
      <div className="flex gap-1 mb-3" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className={`text-2xl leading-none transition-all duration-100 hover:scale-110 active:scale-95 ${
              star <= (hovered || rating) ? 'text-gold' : 'text-ink/15'
            }`}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
        {(hovered || rating) > 0 && (
          <span className="text-xs text-ink/40 self-center ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][hovered || rating]}
          </span>
        )}
      </div>

      <textarea
        className="input text-sm h-20 mb-3 w-full"
        placeholder="Share what made this session valuable (optional)…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
      />

      {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}

      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="btn-primary text-sm py-2 px-5"
      >
        {submitting ? 'Submitting…' : 'Submit review (+5 pts)'}
      </button>
    </form>
  )
}
