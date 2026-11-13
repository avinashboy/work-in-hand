import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { APP_VERSION } from '../../../lib/app-version'
import { AppVersion } from './AppVersion'

afterEach(cleanup)

describe('AppVersion', () => {
  it('shows the version from package.json', () => {
    render(<AppVersion />)

    expect(screen.getByText(`v${APP_VERSION}`)).toBeTruthy()
  })

  it('reads out in full to screen readers', () => {
    render(<AppVersion />)

    expect(screen.getByLabelText(`Version ${APP_VERSION}`)).toBeTruthy()
  })
})
