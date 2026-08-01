declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/**
 * Renders the Google Sign-In button into a container element.
 * Returns a Promise that resolves with the credential (ID token) on success.
 *
 * This uses `renderButton` which is far more reliable than `prompt()` (One Tap),
 * because One Tap silently fails if:
 * - Third-party cookies are blocked
 * - The user dismissed it before (cooldown period)
 * - The browser doesn't support FedCM yet
 */
export function renderGoogleButton(
  containerElement: HTMLElement,
  clientId: string
): Promise<string> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google auth is only available in the browser."));
  }

  const googleClient = window.google?.accounts?.id;
  if (!googleClient) {
    return Promise.reject(new Error("Google Identity Services is not loaded. Try refreshing the page."));
  }

  return new Promise<string>((resolve, reject) => {
    googleClient.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        if (!response.credential) {
          reject(new Error("Google sign-in was cancelled."));
          return;
        }
        resolve(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    googleClient.renderButton(containerElement, {
      type: "standard",
      shape: "pill",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      width: containerElement.offsetWidth || 400,
    });
  });
}

/**
 * Dev fallback: returns a fake token that the backend's dev-mode path accepts.
 */
export function getDevFallbackToken(): string {
  const devEmail = process.env.NEXT_PUBLIC_DEV_GOOGLE_EMAIL ?? "dev@agos.local";
  return `dev-google-token:${devEmail}`;
}

export function isDevFallbackEnabled(clientId: string): boolean {
  return process.env.NODE_ENV !== "production" && (!clientId || clientId.includes("replace"));
}
