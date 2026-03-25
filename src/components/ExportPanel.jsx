export function ExportPanel({ onExport, metadata = {} }) {
  return (
    <div className="export-panel">
      <button className="export-panel__btn" onClick={() => onExport && onExport()}>
        Export VRM
      </button>
      {Object.keys(metadata).length > 0 && (
        <div className="export-panel__metadata">
          {metadata.title && <p>{metadata.title}</p>}
          {metadata.author && <p>{metadata.author}</p>}
        </div>
      )}
    </div>
  )
}

export default ExportPanel
