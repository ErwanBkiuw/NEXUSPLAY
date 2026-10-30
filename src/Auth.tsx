
import { useState } from "react";
import { supabase } from "./lib/supabase";

type AuthProps = {
  onLogin?: () => void;
};

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (mode === "register" && username.trim().length < 3) {
      setMessage("Ton pseudo doit contenir au moins 3 caractères.");
      return;
    }

    if (password.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { username: username.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          onLogin?.();
        } else {
          setMessage(
            "Compte créé ! Vérifie tes e-mails pour confirmer ton inscription."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        onLogin?.();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.panel}>
        <div style={styles.logo}>NEXUS<span>PLAY</span></div>
        <p style={styles.subtitle}>TON UNIVERS GAMING</p>

        <div style={styles.tabs}>
          <button
            type="button"
            style={mode === "login" ? styles.activeTab : styles.tab}
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            style={mode === "register" ? styles.activeTab : styles.tab}
            onClick={() => {
              setMode("register");
              setMessage("");
            }}
          >
            Inscription
          </button>
        </div>

        {mode === "register" && (
          <label style={styles.label}>
            Pseudo joueur
            <input
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="TonPseudo"
              minLength={3}
              maxLength={20}
              autoComplete="nickname"
              required
            />
          </label>
        )}

        <label style={styles.label}>
          Adresse e-mail
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            autoComplete="email"
            required
          />
        </label>

        <label style={styles.label}>
          Mot de passe
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            minLength={8}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
          />
        </label>

        {message && (
          <p role="status" style={styles.message}>{message}</p>
        )}

        <button style={styles.submit} disabled={loading}>
          {loading
            ? "Chargement..."
            : mode === "login"
              ? "SE CONNECTER"
              : "CRÉER MON COMPTE"}
        </button>

        <p style={styles.footer}>
          {mode === "login"
            ? "Prêt à jouer ? Connecte-toi à ton compte."
            : "Rejoins la communauté des joueurs."}
        </p>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#101210",
    color: "#f3f5f3",
    fontFamily: "Segoe UI, sans-serif",
    padding: 24,
  },
  panel: {
    width: "100%",
    maxWidth: 390,
    boxSizing: "border-box",
    padding: 32,
    background: "#191d19",
    border: "1px solid #303830",
    borderRadius: 18,
    boxShadow: "0 20px 70px #0008",
  },
  logo: {
    textAlign: "center",
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 2,
  },
  subtitle: {
    textAlign: "center",
    color: "#8d998d",
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 28,
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: 12,
    background: "#222722",
    color: "#aeb6ae",
    border: "1px solid #343b34",
    borderRadius: 8,
    cursor: "pointer",
  },
  activeTab: {
    flex: 1,
    padding: 12,
    background: "#b5ff45",
    color: "#101510",
    border: "1px solid #b5ff45",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "#c6cec6",
    marginBottom: 16,
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: 13,
    marginTop: 8,
    borderRadius: 8,
    border: "1px solid #3a433a",
    background: "#111411",
    color: "#ffffff",
    outlineColor: "#b5ff45",
  },
  submit: {
    width: "100%",
    padding: 15,
    marginTop: 8,
    border: 0,
    borderRadius: 8,
    background: "#b5ff45",
    color: "#111510",
    fontWeight: 900,
    letterSpacing: 1,
    cursor: "pointer",
  },
  message: {
    color: "#b5ff45",
    fontSize: 13,
    overflowWrap: "anywhere",
  },
  footer: {
    color: "#8d998d",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 1.6,
    marginTop: 20,
  },
};
