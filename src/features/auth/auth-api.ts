import { createServerFn } from '@tanstack/react-start'
import { loginInputSchema } from './auth-model'
import {
  isRequestSignedIn,
  logInRequest,
  logOutRequest,
} from './auth-request.server'

export const getSessionStatus = createServerFn({ method: 'GET' }).handler(() => ({
  signedIn: isRequestSignedIn(),
}))

export const logIn = createServerFn({ method: 'POST' })
  .validator(loginInputSchema)
  .handler(async ({ data }) => ({ status: await logInRequest(data.password) }))

export const logOut = createServerFn({ method: 'POST' }).handler(() => {
  logOutRequest()
  return { signedOut: true }
})
