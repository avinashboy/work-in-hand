import { useMutation } from '@tanstack/react-query'
import { logOut } from '../auth-api'

export function LogoutButton() {
  const logout = useMutation({
    mutationFn: () => logOut(),
    // A full load, so none of the private data stays in memory.
    onSuccess: () => window.location.assign('/login'),
  })

  return (
    <button
      type="button"
      className="logout-button"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
    >
      {logout.isError ? 'Log out failed. Try again' : 'Log out'}
    </button>
  )
}
