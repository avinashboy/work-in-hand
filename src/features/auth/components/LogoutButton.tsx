export function LogoutButton() {
  return (
    <form method="post" action="/api/logout">
      <button type="submit" className="logout-button">
        Log out
      </button>
    </form>
  )
}
