export function getHashParams() {
  return new URLSearchParams(window.location.hash.slice(1));
}