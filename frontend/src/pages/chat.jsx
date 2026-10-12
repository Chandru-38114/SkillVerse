import { Navigate, useParams } from 'react-router-dom'

/*
 * /chat/:requestId used to render a second, older copy of the chat UI that took
 * its requestId from a PROP — but app.jsx renders <Chat /> with no props, so
 * requestId was always undefined and the page rendered an empty shell forever.
 * Discover's "Open Chat →" button pointed straight at it.
 *
 * Connect (/messages) is the real chat page and reads request_id from the query
 * string, so this route now just forwards to it and keeps the old links working.
 */
export default function Chat() {
  const { requestId } = useParams()
  return <Navigate to={requestId ? `/messages?request_id=${requestId}` : '/messages'} replace />
}
