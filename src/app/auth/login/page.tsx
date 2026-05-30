import { redirect } from 'next/navigation'

// /auth/login no es una página real: el login se gestiona desde el
// AuthModal en /perfil. Redirigimos ahí para que el usuario vea el
// modal de entrada inmediatamente.
export default function AuthLoginRedirect() {
  redirect('/perfil')
}
