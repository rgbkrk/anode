import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { LiveStoreProvider } from '@livestore/react'
import { FPSMeter } from '@overengineering/fps-meter'
import type React from 'react'
import { useState, useEffect } from 'react'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'

import { NotebookList } from './components/notebook/NotebookList.js'
import { NotebookViewer } from './components/notebook/NotebookViewer.js'
import LiveStoreWorker from './livestore.worker?worker'
import { schema } from '@anode/schema'
import { getStoreId } from './util/store-id.js'
import { initBrowserReset } from './util/browser-reset.js'

const NotebookApp: React.FC = () => {
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(null)

  const handleSelectNotebook = (notebookId: string) => {
    setCurrentNotebookId(notebookId)
  }

  const handleBackToList = () => {
    setCurrentNotebookId(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="border-b bg-card px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1
              className="text-xl font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleBackToList}
            >
              📓 LiveStore Notebooks
            </h1>
            {currentNotebookId && (
              <>
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={handleBackToList}
                  className="text-primary hover:opacity-80 text-sm transition-opacity"
                >
                  ← Back to Notebooks
                </button>
              </>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Collaborative • Real-time • Event-sourced
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {currentNotebookId ? (
        <NotebookViewer
          notebookId={currentNotebookId}
          onBack={handleBackToList}
        />
      ) : (
        <NotebookList onSelectNotebook={handleSelectNotebook} />
      )}
    </div>
  )
}

const storeId = getStoreId()

// Check for reset parameter to clear browser storage
const resetPersistence = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('reset') !== null

if (resetPersistence) {
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.delete('reset')
  window.history.replaceState(null, '', `${window.location.pathname}?${searchParams.toString()}`)
}

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
  resetPersistence,
})

export const App: React.FC = () => {
  useEffect(() => {
    // Initialize browser reset utilities in development
    initBrowserReset()
  }, [])

  return (
    <LiveStoreProvider
      schema={schema}
      adapter={adapter}
      renderLoading={(_) => (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground mb-2">
              Loading LiveStore Notebooks
            </div>
            <div className="text-sm text-muted-foreground">
              Stage: {_.stage}
            </div>
            {import.meta.env.DEV && (
              <div className="text-xs text-muted-foreground mt-2">
                💡 Add ?reset to URL for clean browser storage
              </div>
            )}
          </div>
        </div>
      )}
      batchUpdates={batchUpdates}
      storeId={storeId}
      syncPayload={{ authToken: 'insecure-token-change-me' }}
    >
      <div style={{ top: 0, right: 0, position: 'absolute', background: '#333', zIndex: 50 }}>
        <FPSMeter height={40} />
      </div>
      <NotebookApp />
    </LiveStoreProvider>
  )
}
