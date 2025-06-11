import React, {
  createContext,
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const MILLISECONDS_UNTIL_EXPIRY_CHECK = 10 * 1000; // check expiry every 10 seconds
const REMAINING_TOKEN_EXPIRY_TIME_ALLOWED = 60 * 1000; // 1 minute before token should be refreshed

// Global refresh promise to prevent race conditions
let refreshPromise: Promise<void> | null = null;

// Extend the AccessTokenClaims interface to include user info
interface ExtendedAccessTokenClaims extends AccessTokenClaims {
  email?: string;
  firstname?: string;
  lastname?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
}

class Permissions {
  private readonly rolesSet: Set<string>;
  private readonly rolesArray: string[];

  private readonly permissionsSet: Set<string>;
  private readonly permissionsArray: string[];

  constructor(roles: string[], perms: Permission[]) {
    this.rolesArray = roles;
    this.permissionsArray = perms.map((p) => p.permission);

    this.rolesSet = new Set(this.rolesArray);
    this.permissionsSet = new Set(this.permissionsArray);
  }

  public get roles(): string[] {
    return this.rolesArray;
  }

  public get permissions(): string[] {
    return this.permissionsArray;
  }

  public hasRole = (role: string): boolean => {
    return this.rolesSet.has(role);
  };

  public hasPermission = (permission: string): boolean => {
    return this.permissionsSet.has(permission);
  };
}

interface Session {
  expiresOnUTC: number;
  userId: ID;
  roles: string[];
  permissions: string[];
  user?: {
    email?: string;
    firstname?: string;
    lastname?: string;
  };
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
}

interface AuthContext {
  accessToken: string | undefined;
  session: Session | undefined;
  isLoading: boolean;
  setAccessToken: (accessToken: string | undefined) => void;
  setSession: (session: Session | undefined) => void;
  setIsLoading: (loading: boolean) => void;
  isCheckingAuth: MutableRefObject<boolean>;
}

interface AuthWrapperProps {
  children: React.ReactNode;
}

const Context = createContext<AuthContext>(undefined as any);

export const AuthProvider = (props: AuthWrapperProps) => {
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [session, setSession] = useState<Session | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isCheckingAuth = useRef<boolean>(false);

  return (
    <Context.Provider
      value={{
        accessToken,
        session,
        isLoading,
        setAccessToken,
        setSession,
        setIsLoading,
        isCheckingAuth,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

// Helper function to extract user info from token claims
const extractUserInfo = (
  claims: ExtendedAccessTokenClaims,
  fallbackEmail?: string,
) => {
  return {
    email: claims.email || claims.preferred_username || fallbackEmail || "",
    firstname: claims.firstname || claims.given_name || "",
    lastname: claims.lastname || claims.family_name || "",
  };
};

export const useAuth = () => {
  const context = useContext(Context);

  const login = async (email: string, password: string): Promise<boolean> => {
    context.setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const responseJson = await response.json();
        const parsedToken = parseJwt(
          responseJson.access_token,
        ) as ExtendedAccessTokenClaims;
        const permissions = new Permissions(
          parsedToken.roles,
          parsedToken.permissions,
        );
        const userInfo = extractUserInfo(parsedToken, email);

        context.setAccessToken(responseJson.access_token);
        context.setSession({
          userId: parsedToken.sub,
          expiresOnUTC: parsedToken.exp,
          roles: permissions.roles,
          permissions: permissions.permissions,
          user: userInfo,
          hasPermission: permissions.hasPermission,
          hasRole: permissions.hasRole,
        });
        return true;
      } else {
        context.setAccessToken(undefined);
        context.setSession(undefined);
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      context.setAccessToken(undefined);
      context.setSession(undefined);
      return false;
    } finally {
      context.setIsLoading(false);
    }
  };

  const loginOIDC = async (
    provider: string,
    options?: { redirectUrl?: "current-url" | string },
  ) => {
    if (options?.redirectUrl) {
      localStorage.setItem(
        "create_rust_app_oauth_redirect",
        options?.redirectUrl === "current-url"
          ? window.location.href
          : options.redirectUrl,
      );
    } else {
      localStorage.removeItem("create_rust_app_oauth_redirect");
    }

    window.location.href = `/api/auth/oidc/${provider}`;
  };

  const completeOIDCLogin = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const access_token = params.get("access_token");
    if (!access_token) {
      context.setAccessToken(undefined);
      context.setSession(undefined);
      context.setIsLoading(false);
      return false;
    } else {
      const parsedToken = parseJwt(access_token) as ExtendedAccessTokenClaims;
      const permissions = new Permissions(
        parsedToken.roles,
        parsedToken.permissions,
      );
      const userInfo = extractUserInfo(parsedToken);

      context.setAccessToken(access_token);
      context.setSession({
        userId: parsedToken.sub,
        expiresOnUTC: parsedToken.exp,
        roles: permissions.roles,
        permissions: permissions.permissions,
        user: userInfo,
        hasPermission: permissions.hasPermission,
        hasRole: permissions.hasRole,
      });
      context.setIsLoading(false);

      if (localStorage.getItem("create_rust_app_oauth_redirect")) {
        window.location.href = localStorage.getItem(
          "create_rust_app_oauth_redirect",
        ) as string;
      }

      return true;
    }
  };

  // Enhanced logout with proper error handling and loading states
  const logout = useCallback(async (): Promise<boolean> => {
    context.setIsLoading(true);
    try {
      // Always clear local state first to prevent UI inconsistencies
      const currentToken = context.accessToken;

      // Clear state immediately to prevent loops
      context.setAccessToken(undefined);
      context.setSession(undefined);

      // Then try to notify the server (but don't fail if this doesn't work)
      if (currentToken) {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${currentToken}`,
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.warn(
            "Server logout failed, but local logout succeeded:",
            error,
          );
        }
      }

      // Clear any stored tokens
      localStorage.removeItem("create_rust_app_oauth_redirect");

      return true;
    } catch (error) {
      console.error("Logout error:", error);
      // Ensure state is cleared even if there's an error
      context.setAccessToken(undefined);
      context.setSession(undefined);
      return false;
    } finally {
      context.setIsLoading(false);
    }
  }, [context]);

  return {
    accessToken: context.accessToken,
    session: context.session,
    isLoading: context.isLoading,
    isCheckingAuth: context.isCheckingAuth,
    isAuthenticated: !!context.accessToken,
    login,
    logout,
    loginOIDC,
    completeOIDCLogin,
  };
};

export const useAuthCheck = () => {
  const context = useContext(Context);
  const { isCheckingAuth } = context;

  const refreshIfNecessary = useCallback(async () => {
    // If a refresh is already in progress, wait for it to complete
    if (refreshPromise) {
      await refreshPromise;
      return;
    }

    if (isCheckingAuth.current) {
      return;
    }
    isCheckingAuth.current = true;

    const isExpiringSoon = () => {
      if (context.session?.expiresOnUTC) {
        const expireTimeMS = context.session.expiresOnUTC * 1000;
        const currentTimeMS = Date.now();

        return (
          expireTimeMS - currentTimeMS <= REMAINING_TOKEN_EXPIRY_TIME_ALLOWED
        );
      }

      return true;
    };

    // Create the refresh promise to prevent race conditions
    refreshPromise = (async () => {
      try {
        if (!context.accessToken || isExpiringSoon()) {
          // console.log('Restoring session')
          const response = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include", // CRITICAL: Include cookies in request
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const responseJson = await response.json();
            const parsedToken = parseJwt(
              responseJson.access_token,
            ) as ExtendedAccessTokenClaims;
            const permissions = new Permissions(
              parsedToken.roles,
              parsedToken.permissions,
            );
            const userInfo = extractUserInfo(parsedToken);

            context.setAccessToken(responseJson.access_token);
            context.setSession({
              userId: parsedToken.sub,
              expiresOnUTC: parsedToken.exp,
              roles: permissions.roles,
              permissions: permissions.permissions,
              user: userInfo,
              hasRole: permissions.hasRole,
              hasPermission: permissions.hasPermission,
            });
          } else {
            // Log specific error information for debugging
            console.warn(`Auth refresh failed with status: ${response.status} ${response.statusText}`);
            
            // Try to get the error response body for more details
            try {
              const errorText = await response.text();
              console.warn("Auth refresh error response:", errorText);
            } catch (e) {
              console.warn("Could not read error response body");
            }
            
            context.setAccessToken(undefined);
            context.setSession(undefined);
          }
        }
      } catch (error) {
        console.error("Auth refresh error:", error);
        console.error("Refresh token fetch failed. This could be due to:");
        console.error("1. CORS misconfiguration");
        console.error("2. Missing or expired refresh token cookie");
        console.error("3. Backend server issues");
        context.setAccessToken(undefined);
        context.setSession(undefined);
      } finally {
        // Set loading to false after initial auth check
        context.setIsLoading(false);
        isCheckingAuth.current = false;
        // Clear the refresh promise when done
        refreshPromise = null;
      }
    })();

    // Wait for the refresh to complete
    await refreshPromise;
  }, [context]);

  useEffect(() => {
    refreshIfNecessary();
    let intervalId: NodeJS.Timeout | undefined = undefined;

    if (context.accessToken) {
      // if the access token is set, we want to check its expiry on some interval
      intervalId = setInterval(() => {
        refreshIfNecessary();
      }, MILLISECONDS_UNTIL_EXPIRY_CHECK);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [refreshIfNecessary]);
};

// https://stackoverflow.com/a/38552302
const parseJwt = (token: string) => {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );

  return JSON.parse(jsonPayload);
};
