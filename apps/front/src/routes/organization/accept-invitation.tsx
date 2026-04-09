import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/lib/auth-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/organization/accept-invitation')({
  component: AcceptInvitationPage,
})

function AcceptInvitationPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/organization/accept-invitation' })
  const invitationId = (search as any).id as string | undefined
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!invitationId) {
      setStatus('error')
      setError('Invalid invitation link. No invitation ID provided.')
      return
    }

    if (!auth.isAuthenticated) {
      const redirectUrl = `/organization/accept-invitation?id=${encodeURIComponent(invitationId)}`
      navigate({
        to: '/signin',
        search: { redirect: redirectUrl } as any,
      })
      return
    }

    acceptInvitation()
  }, [auth.isAuthenticated, invitationId])

  async function acceptInvitation() {
    if (!invitationId) return

    const { error: acceptError } = await authClient.organization.acceptInvitation({
      invitationId,
    })

    if (acceptError) {
      setStatus('error')
      setError(acceptError.message ?? 'Failed to accept invitation.')
      return
    }

    setStatus('success')
    setTimeout(() => {
      navigate({ to: '/orgs' })
    }, 1500)
  }

  if (!auth.isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Accepting invitation...</h2>
              <p className="text-muted-foreground">Please wait while we process your invitation.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="h-12 w-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Invitation accepted!</h2>
              <p className="text-muted-foreground">Redirecting you to your organizations...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="h-12 w-12 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate({ to: '/orgs' })}>
                Go to organizations
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
