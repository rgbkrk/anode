import React, { useEffect, useRef } from 'react'
import { useGoogleAuth } from '../../auth/useGoogleAuth.js'
import { googleAuthManager } from '../../auth/google-auth.js'

interface GoogleSignInProps {
  onSignIn?: () => void
  className?: string
}

export const GoogleSignIn: React.FC<GoogleSignInProps> = ({
  className = ''
}) => {
  const { isLoading, error } = useGoogleAuth()
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize Google Sign-In button when component mounts
    const initializeButton = async () => {
      if (buttonRef.current && googleAuthManager.isEnabled()) {
        try {
          await googleAuthManager.initialize()
          googleAuthManager.renderSignInButton(buttonRef.current)
        } catch (error) {
          console.error('Failed to initialize Google Sign-In button:', error)
        }
      }
    }

    initializeButton()
  }, [])



  // Don't render if Google Auth is not enabled
  if (!googleAuthManager.isEnabled()) {
    return null
  }

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      {/* Google's official sign-in button */}
      <div ref={buttonRef} />

      {/* Fallback button if Google's button fails to load */}
      {isLoading && (
        <button
          disabled
          className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 opacity-50 cursor-not-allowed"
        >
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
          Signing in...
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
