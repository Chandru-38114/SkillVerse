// Shows SQL results (or a message like "2 row(s) changed") as small tables.
export default function SqlTable({ results }) {
  if (!results || results.length === 0) return <span className="muted">No result.</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {results.map((r, i) => r.columns ? (
        <div key={i} style={{ overflowX: 'auto' }}>
          <table className="mono" style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 160 }}>
            <thead><tr>{r.columns.map((c, j) => <th key={j} style={{ textAlign: 'left', padding: '4px 10px', borderBottom: '2px solid #6E6455', color: '#FBEFC4' }}>{c}</th>)}</tr></thead>
            <tbody>{r.rows.map((row, k) => <tr key={k}>{row.map((v, j) => <td key={j} style={{ padding: '3px 10px', borderBottom: '1px solid #3A352D' }}>{v === null ? 'NULL' : String(v)}</td>)}</tr>)}</tbody>
          </table>
          <div style={{ color: '#8C8273', fontSize: 11, marginTop: 4 }}>{r.rows.length} row(s){r.truncated ? ' (first 200 shown)' : ''}</div>
        </div>
      ) : <div key={i} style={{ color: '#B9AE9C', fontSize: 12 }}>{r.message}</div>)}
    </div>
  )
}
