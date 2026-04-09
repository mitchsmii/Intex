export const COOKIE_CONSENT_NAME = 'cookie_consent'
export const THEME_COOKIE_NAME = 'theme'
const ONE_YEAR_SECONDS = 31536000

function getCookieSecurityAttributes() {
  return window.location.protocol === 'https:' ? '; Secure' : ''
}

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setPersistentCookie(name: string, value: string) {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; SameSite=Lax${getCookieSecurityAttributes()}; path=/; max-age=${ONE_YEAR_SECONDS}`
}

export function deleteCookie(name: string) {
  document.cookie = `${name}=; SameSite=Lax${getCookieSecurityAttributes()}; path=/; max-age=0`
}
