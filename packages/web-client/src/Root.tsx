import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { LiveStoreProvider } from '@livestore/react'
import { FPSMeter } from '@overengineering/fps-meter'

import React, { useState, useEffect } from 'react'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'

import { NotebookViewer } from './components/notebook/NotebookViewer.js'
import LiveStoreWorker from './livestore.worker?worker'
import { schema, events, tables } from '../../../shared/schema.js'
import { getStoreId, getCurrentNotebookId } from './util/store-id.js'
import { useStore } from '@livestore/react'
import { queryDb } from '@livestore/livestore'

const NotebookApp: React.FC = () => {
  // In the simplified architecture, we always show the current notebook
  // The notebook ID comes from the URL and is the same as the store ID
  const currentNotebookId = getCurrentNotebookId()
  const { store } = useStore()
  const [isInitializing, setIsInitializing] = useState(false)

  // Check if notebook exists
  const notebooks = store.useQuery(queryDb(tables.notebook.select().limit(1))) as any[]
  const currentNotebook = notebooks[0]

  // Auto-initialize notebook if it doesn't exist
  useEffect(() => {
    if (!currentNotebook && !isInitializing) {
      setIsInitializing(true)
      const notebookId = store.storeId || `notebook-${Date.now()}`
      const title = `Notebook ${new Date().toLocaleDateString()}`

      store.commit(events.notebookInitialized({
        id: notebookId,
        title,
        ownerId: 'current-user', // TODO: get from auth
      }))

      setIsInitializing(false)
    }
  }, [currentNotebook, isInitializing, store])

  const createNewNotebook = () => {
    // Navigate to clean URL which will create a new store/notebook
    window.location.href = window.location.origin
  }

  // Show loading while initializing
  if (!currentNotebook && isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground mb-2">
            Initializing Notebook
          </div>
          <div className="text-sm text-muted-foreground">
            Setting up your workspace...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <NotebookViewer
        notebookId={currentNotebookId}
        onNewNotebook={createNewNotebook}
      />
    </div>
  )
}

const storeId = getStoreId()

// Check for reset parameter to handle schema evolution issues
const resetPersistence = new URLSearchParams(window.location.search).get('reset') !== null

// Clean up URL if reset was requested
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

export const App: React.FC = () => (
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
