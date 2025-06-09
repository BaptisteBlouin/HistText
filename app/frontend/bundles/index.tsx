import { AuthProvider } from "../src/hooks/useAuth";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "../src/App";
import reportWebVitals from "../src/reportWebVitals";
import { BrowserRouter } from "react-router-dom";

import { ApolloProvider } from "@apollo/client";
import { useAuthenticatedApolloClient } from "../src/hooks/useAuthenticatedApolloClient";

const AuthenticatedApolloProvider = (props: { children: React.ReactNode }) => {
  const client = useAuthenticatedApolloClient();

  return <ApolloProvider client={client}>{props.children}</ApolloProvider>;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* CRA: Wrap */}
    <AuthProvider>
      <AuthenticatedApolloProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        {/* CRA: Unwrap */}
      </AuthenticatedApolloProvider>
    </AuthProvider>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
