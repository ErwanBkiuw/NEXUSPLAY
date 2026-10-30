import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import Auth from "./Auth";
import { supabase } from "./lib/supabase";
import "./App.css";

type Page = "home" | "library" | "friends" | "settings";

type Profile = {
  id: string;
  public_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  profile_style: string;
};

type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
};

type Friend = Profile & {
  online: boolean;
  avatarDisplay: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

const styleOptions = [
  { id: "default", label: "Classique", background: "#171923", color: "#ffffff" },
  { id: "purple", label: "Violet", background: "#302052", color: "#ffffff" },
  { id: "blue", label: "Bleu", background: "#15334b", color: "#ffffff" },
  { id: "red", label: "Rouge", background: "#48212a", color: "#ffffff" },
  { id: "green", label: "Vert", background: "#183b32", color: "#ffffff" },
];

/* -------------------------------------------------------
   GESTION DES MISES À JOUR
------------------------------------------------------- */

function UpdateManager() {
  const [available, setAvailable] = useState(false);
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkForUpdate() {
      try {
        const update = await check();

        if (active && update) {
          setAvailable(true);
          setVersion(update.version);
        }
      } catch (err) {
        console.error("Vérification des mises à jour :", err);
      }
    }

    void checkForUpdate();

    return () => {
      active = false;
    };
  }, []);

  async function installUpdate() {
    setInstalling(true);
    setError("");
    setProgress(0);
    setStatus("Téléchargement de la mise à jour...");

    try {
      const update = await check();

      if (!update) {
        setAvailable(false);
        setStatus("Aucune mise à jour disponible.");
        setInstalling(false);
        return;
      }

      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength || 0;
          setStatus("Téléchargement...");
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;

          if (total > 0) {
            setProgress(
              Math.min(100, Math.round((downloaded / total) * 100))
            );
          }
        } else if (event.event === "Finished") {
          setProgress(100);
          setStatus("Installation terminée. Redémarrage...");
        }
      });

      await relaunch();
    } catch (err) {
      console.error("Erreur de mise à jour :", err);
      setError("La mise à jour a échoué. Réessaie plus tard.");
      setInstalling(false);
    }
  }

  if (!available && !installing && !error) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,.75)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#171923",
          color: "white",
          padding: 28,
          borderRadius: 16,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 70px rgba(0,0,0,.5)",
        }}
      >
        <h2>🚀 Mise à jour NEXUSPLAY</h2>

        {available && (
          <p>Une nouvelle version ({version}) est disponible !</p>
        )}

        {installing && (
          <>
            <p>{status}</p>

            <div
              style={{
                height: 9,
                background: "#333747",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "#7770ff",
                  transition: "width .2s",
                }}
              />
            </div>

            <p>{progress}%</p>
          </>
        )}

        {error && (
          <p style={{ color: "#ff7777" }}>{error}</p>
        )}

        {available && !installing && (
          <button
            className="primary-button"
            onClick={() => void installUpdate()}
          >
            Télécharger et installer
          </button>
        )}

        {error && (
          <button
            className="primary-button"
            onClick={() => void installUpdate()}
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   APPLICATION PRINCIPALE
------------------------------------------------------- */

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setAuthError("Impossible de vérifier la connexion.");
      } else {
        setSession(data.session);
      }

      setAuthReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;

      setSession(newSession);
      setAuthError("");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setSession(null);
  }

  return (
    <>
      {/* Vérification des mises à jour, même sans être connecté */}
      <UpdateManager />

      {!authReady ? (
        <main className="auth-loading">
          <div>
            <h1>
              NEXUS<span>PLAY</span>
            </h1>
            <p>Chargement de ton compte...</p>
          </div>
        </main>
      ) : !session ? (
        <>
          {authError && (
            <p role="alert" className="auth-error">
              {authError}
            </p>
          )}
          <Auth />
        </>
      ) : (
        <Launcher
          key={session.user.id}
          session={session}
          onLogout={logout}
        />
      )}
    </>
  );
}

type LauncherProps = {
  session: Session;
  onLogout: () => Promise<void>;
};

/* -------------------------------------------------------
   LAUNCHER
------------------------------------------------------- */

function Launcher({ session, onLogout }: LauncherProps) {
  const userId = session.user.id;
  const [page, setPage] = useState<Page>("home");

  const [, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState(
    session.user.user_metadata?.username ||
      session.user.email?.split("@")[0] ||
      "Joueur"
  );
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileStyle, setProfileStyle] = useState("default");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [publicId, setPublicId] = useState("Chargement...");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<
    { request: FriendRequest; profile: Profile }[]
  >([]);
  const [outgoing, setOutgoing] = useState<
    { request: FriendRequest; profile: Profile }[]
  >([]);
  const [newFriend, setNewFriend] = useState("");
  const [searching, setSearching] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [acceptingId, setAcceptingId] = useState("");

  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentStyle =
    styleOptions.find((style) => style.id === profileStyle) ||
    styleOptions[0];

  async function getAvatarUrl(path: string | null) {
    if (!path) return "";

    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60);

    if (error) {
      console.error("Erreur photo :", error);
      return "";
    }

    return data.signedUrl;
  }

  // Charger le profil personnel
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, public_id, username, avatar_url, bio, profile_style")
        .eq("id", userId)
        .single();

      if (!active) return;

      if (error || !data) {
        console.error("Erreur profil :", error);
        setProfileError("Impossible de charger ton profil.");
      } else {
        const loaded = data as Profile;

        setProfile(loaded);
        setPublicId(loaded.public_id);
        setUsername(loaded.username);
        setBio(loaded.bio || "");
        setAvatarPath(loaded.avatar_url || "");
        setProfileStyle(loaded.profile_style || "default");

        const url = await getAvatarUrl(loaded.avatar_url);

        if (active) setAvatarUrl(url);
      }

      if (active) setProfileLoading(false);
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [userId]);

  // Présence en ligne avec Supabase Realtime
  useEffect(() => {
    const channel = supabase.channel("nexusplay-presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            username,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, username]);

  // Charger les amis et les demandes
  async function loadFriends() {
    setLoadingFriends(true);
    setFriendError("");

    const { data: requests, error } = await supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
      console.error(error);
      setFriendError(
        "Impossible de charger les amis. Vérifie les permissions Supabase."
      );
      setLoadingFriends(false);
      return;
    }

    const allRequests = (requests || []) as FriendRequest[];

    const otherIds = [
      ...new Set(
        allRequests.map((request) =>
          request.sender_id === userId
            ? request.receiver_id
            : request.sender_id
        )
      ),
    ];

    if (otherIds.length === 0) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setLoadingFriends(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, public_id, username, avatar_url, bio, profile_style")
      .in("id", otherIds);

    if (profilesError) {
      console.error(profilesError);
      setFriendError("Impossible de récupérer les profils des joueurs.");
      setLoadingFriends(false);
      return;
    }

    const profileMap = new Map<string, Profile>(
      ((profiles || []) as Profile[]).map((item) => [item.id, item])
    );

    const accepted: Friend[] = [];
    const received: { request: FriendRequest; profile: Profile }[] = [];
    const sent: { request: FriendRequest; profile: Profile }[] = [];

    for (const request of allRequests) {
      const otherId =
        request.sender_id === userId
          ? request.receiver_id
          : request.sender_id;

      const otherProfile = profileMap.get(otherId);

      if (!otherProfile) continue;

      if (request.status === "accepted") {
        const image = await getAvatarUrl(otherProfile.avatar_url);

        accepted.push({
          ...otherProfile,
          online: onlineIds.includes(otherProfile.id),
          avatarDisplay: image,
        });
      } else if (
        request.status === "pending" &&
        request.receiver_id === userId
      ) {
        received.push({ request, profile: otherProfile });
      } else if (
        request.status === "pending" &&
        request.sender_id === userId
      ) {
        sent.push({ request, profile: otherProfile });
      }
    }

    setFriends(accepted);
    setIncoming(received);
    setOutgoing(sent);
    setLoadingFriends(false);
  }

  useEffect(() => {
    void loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, onlineIds]);

  // Actualiser les amis quand une demande change
  useEffect(() => {
    const channel = supabase
      .channel(`friend-requests-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => void loadFriends()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function addFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const searchedId = newFriend.trim().toUpperCase();

    setFriendError("");
    setFriendSuccess("");

    if (!searchedId.startsWith("NX-") || searchedId.length < 6) {
      setFriendError(
        "Entre un ID joueur valide, par exemple NX-A1B2C3D4."
      );
      return;
    }

    if (searchedId === publicId.toUpperCase()) {
      setFriendError("Tu ne peux pas t'ajouter toi-même !");
      return;
    }

    setSearching(true);

    try {
      const { data: player, error: searchError } = await supabase
        .from("profiles")
        .select("id, public_id, username")
        .eq("public_id", searchedId)
        .maybeSingle();

      if (searchError || !player) {
        setFriendError(
          searchError
            ? "Erreur pendant la recherche du joueur."
            : "Aucun joueur trouvé avec cet ID."
        );
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from("friend_requests")
        .select("id, status, sender_id, receiver_id")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${player.id}),and(sender_id.eq.${player.id},receiver_id.eq.${userId})`
        );

      if (existingError) {
        setFriendError("Impossible de vérifier les demandes existantes.");
        return;
      }

      const relation = existing?.[0];

      if (relation?.status === "accepted") {
        setFriendError("Ce joueur est déjà dans ta liste d'amis.");
        return;
      }

      if (relation?.status === "pending") {
        setFriendError(
          relation.sender_id === userId
            ? "Tu as déjà envoyé une demande à ce joueur."
            : "Ce joueur t'a déjà envoyé une demande. Accepte-la dans tes demandes reçues !"
        );
        return;
      }

      if (relation?.status === "rejected") {
        setFriendError("Une ancienne demande existe déjà. Réessaie plus tard.");
        return;
      }

      const { error: insertError } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: userId,
          receiver_id: player.id,
          status: "pending",
        });

      if (insertError) {
        console.error(insertError);
        setFriendError("Impossible d'envoyer la demande. Réessaie.");
        return;
      }

      setFriendSuccess(`Demande envoyée à ${player.username} !`);
      setNewFriend("");
      await loadFriends();
    } finally {
      setSearching(false);
    }
  }

  async function acceptRequest(requestId: string) {
    setAcceptingId(requestId);
    setFriendError("");

    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId)
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (error) {
      setFriendError("Impossible d'accepter cette demande.");
    } else {
      setFriendSuccess("Demande acceptée ! Vous êtes maintenant amis.");
      await loadFriends();
    }

    setAcceptingId("");
  }

  async function rejectRequest(requestId: string) {
    setFriendError("");

    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (error) {
      setFriendError("Impossible de refuser cette demande.");
    } else {
      setFriendSuccess("Demande refusée.");
      await loadFriends();
    }
  }

  // Enregistrer le profil dans Supabase
  async function saveProfile() {
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    const cleanUsername = username.trim();

    if (cleanUsername.length < 2 || cleanUsername.length > 24) {
      setProfileError("Ton pseudo doit contenir entre 2 et 24 caractères.");
      setProfileSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        bio: bio.trim().slice(0, 160),
        profile_style: profileStyle,
      })
      .eq("id", userId);

    if (error) {
      console.error(error);
      setProfileError("Impossible d'enregistrer ton profil.");
    } else {
      setUsername(cleanUsername);
      setProfileSuccess("Ton profil a bien été enregistré !");

      setProfile((old) =>
        old
          ? {
              ...old,
              username: cleanUsername,
              bio: bio.trim(),
              profile_style: profileStyle,
            }
          : old
      );
    }

    setProfileSaving(false);
  }

  // Envoyer une photo depuis le PC
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setProfileError("");
    setProfileSuccess("");

    if (!file.type.startsWith("image/")) {
      setProfileError("Choisis un fichier image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError("La photo doit faire moins de 5 Mo.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      setProfileError(
        "Impossible d'envoyer la photo. Vérifie les permissions Storage."
      );
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);

    if (updateError) {
      console.error(updateError);
      setProfileError(
        "Photo envoyée, mais impossible de mettre à jour le profil."
      );
      return;
    }

    setAvatarPath(path);
    setAvatarUrl(await getAvatarUrl(path));
    setProfileSuccess("Photo de profil mise à jour !");
    await loadFriends();
  }

  async function removeAvatar() {
    if (avatarPath) {
      const { error } = await supabase.storage
        .from("avatars")
        .remove([avatarPath]);

      if (error) {
        console.error(error);
        setProfileError("Impossible de supprimer cette photo.");
        return;
      }
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);

    setAvatarPath("");
    setAvatarUrl("");
    setProfileSuccess("Photo supprimée.");
    await loadFriends();
  }

  async function copyPlayerId() {
    if (!publicId.startsWith("NX-")) return;

    try {
      await navigator.clipboard.writeText(publicId);
      setCopyMessage("ID copié !");
    } catch {
      setCopyMessage("Impossible de copier l'ID.");
    }
  }

  // Ouvrir une conversation et charger son historique
  async function openChat(friend: Friend) {
    setSelectedFriend(friend);
    setChatOpen(true);
    setMessages([]);
    setMessageError("");
    setMessagesLoading(true);

    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at, read_at")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setMessageError("Impossible de charger les messages.");
    } else {
      setMessages((data || []) as Message[]);

      const unreadIds = (data || [])
        .filter(
          (message: Message) =>
            message.receiver_id === userId && !message.read_at
        )
        .map((message: Message) => message.id);

      if (unreadIds.length > 0) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
    }

    setMessagesLoading(false);
  }

  // Écouter les nouveaux messages en temps réel
  useEffect(() => {
    if (!selectedFriend || !chatOpen) return;

    const friendId = selectedFriend.id;

    const channel = supabase
      .channel(`messages-${userId}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;

          const belongsToConversation =
            (message.sender_id === userId &&
              message.receiver_id === friendId) ||
            (message.sender_id === friendId &&
              message.receiver_id === userId);

          if (!belongsToConversation) return;

          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) {
              return current;
            }

            return [...current, message];
          });

          if (message.receiver_id === userId) {
            void supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", message.id);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedFriend, userId, chatOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFriend || !messageText.trim()) return;

    setSendingMessage(true);
    setMessageError("");

    const content = messageText.trim();

    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: selectedFriend.id,
      content,
    });

    if (error) {
      console.error(error);
      setMessageError("Impossible d'envoyer le message.");
    } else {
      setMessageText("");
    }

    setSendingMessage(false);
  }

  async function handleLogout() {
    setLogoutError("");

    try {
      await onLogout();
    } catch {
      setLogoutError("Impossible de se déconnecter.");
    }
  }

  const navItems: { id: Page; icon: string; label: string }[] = [
    { id: "home", icon: "⌂", label: "Accueil" },
    { id: "library", icon: "▦", label: "Bibliothèque" },
    { id: "friends", icon: "♧", label: "Amis" },
    { id: "settings", icon: "⚙", label: "Paramètres" },
  ];

  function Avatar({
    url,
    name,
    className = "friend-avatar",
  }: {
    url?: string;
    name: string;
    className?: string;
  }) {
    return (
      <div className={className}>
        {url ? (
          <img
            src={url}
            alt={`Photo de ${name}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "inherit",
            }}
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
    );
  }

  return (
    <main className="launcher">
      <aside className="sidebar">
        <div className="brand-icon">N</div>

        <nav className="navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
              title={item.label}
            >
              <span>{item.icon}</span>
            </button>
          ))}
        </nav>

        <button
          className="add-game"
          onClick={() => setPage("library")}
          title="Bibliothèque"
        >
          +
        </button>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="greeting">
            <span className="online-dot" />
            <div>
              <span className="muted-text">BON RETOUR,</span>
              <h2>{username}</h2>
            </div>
          </div>

          <label className="search-box">
            <span>⌕</span>
            <input placeholder="Rechercher..." />
          </label>

          <div className="top-actions">
            <button onClick={() => setPage("friends")} title="Amis">
              ♧
            </button>
            <button onClick={() => setPage("settings")} title="Profil">
              ●
            </button>
          </div>
        </header>

        {page === "home" && (
          <div className="dashboard">
            <section className="featured">
              <div className="featured-copy">
                <span className="tag">
                  <span className="online-dot" /> TON UNIVERS
                </span>

                <h1>
                  Le jeu commence
                  <br />
                  <span>ici.</span>
                </h1>

                <p>
                  Tous tes jeux et tes prochaines aventures, réunis au même
                  endroit.
                </p>

                <button
                  className="primary-button"
                  onClick={() => setPage("library")}
                >
                  Explorer ma bibliothèque <span>→</span>
                </button>
              </div>

              <div className="featured-art">
                <div className="art-ring ring-1" />
                <div className="art-ring ring-2" />
                <div className="art-ring ring-3" />
                <div className="art-center">N</div>
                <span className="art-caption">NEXT LEVEL</span>
              </div>
            </section>

            <div className="content-grid">
              <div className="left-column">
                <section className="games-section">
                  <div className="section-heading">
                    <h2>Nouveaux jeux</h2>
                    <button onClick={() => setPage("library")}>
                      Voir tout ↗
                    </button>
                  </div>

                  <div className="game-grid">
                    {[1, 2, 3].map((number) => (
                      <button
                        className={`game-card game-card-${number}`}
                        key={number}
                        onClick={() => setPage("library")}
                      >
                        <div className="game-placeholder">
                          <span className="placeholder-plus">＋</span>
                          <span className="placeholder-label">
                            EMPLACEMENT LIBRE
                          </span>
                        </div>

                        <div className="game-card-info">
                          <span>Emplacement {number}</span>
                          <span className="game-card-arrow">↗</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="downloads-section">
                  <div className="section-heading">
                    <h2>Téléchargements</h2>
                    <span className="muted-text">0 actif</span>
                  </div>

                  <div className="download-panel">
                    <div className="download-icon">↓</div>

                    <div className="download-copy">
                      <strong>Aucun téléchargement</strong>
                      <span>Tes téléchargements apparaîtront ici.</span>
                    </div>

                    <div className="download-status">
                      <span className="download-track">
                        <span />
                      </span>
                      En attente
                    </div>
                  </div>
                </section>
              </div>

              <aside className="stats-column">
                <div className="section-heading">
                  <h2>Mon espace</h2>
                </div>

                <div className="stats-panel">
                  <div className="stats-content">
                    <span className="section-kicker">TON PROFIL</span>

                    <div
                      className="stats-symbol"
                      style={{
                        background: currentStyle.background,
                        color: currentStyle.color,
                        overflow: "hidden",
                      }}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Mon avatar"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        username.charAt(0).toUpperCase()
                      )}
                    </div>

                    <h3>{username}</h3>
                    <p>
                      <span className="online-dot" /> En ligne
                    </p>
                  </div>

                  <div className="stats-footer">
                    <span>AMIS</span>
                    <strong>{String(friends.length).padStart(2, "0")}</strong>
                    <span>JEUX</span>
                    <strong>00</strong>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {page === "library" && (
          <div className="subpage">
            <span className="section-kicker">TA COLLECTION</span>
            <h1>
              Bibliothèque<span>.</span>
            </h1>
            <p className="page-description">
              Tes jeux seront réunis ici.
            </p>

            <div className="empty-state">
              <div className="empty-symbol">＋</div>
              <h2>Ta bibliothèque est vide</h2>
              <p>Les jeux que tu ajouteras apparaîtront ici.</p>
            </div>
          </div>
        )}

        {page === "friends" && (
          <div className="subpage">
            <span className="section-kicker">JOUE ENSEMBLE</span>
            <h1>
              Mes amis<span>.</span>
            </h1>

            <p className="page-description">
              {friends.length} ami{friends.length > 1 ? "s" : ""} dans ta liste.
            </p>

            <form className="friend-add-form" onSubmit={addFriend}>
              <input
                value={newFriend}
                onChange={(event) => {
                  setNewFriend(event.target.value);
                  setFriendError("");
                  setFriendSuccess("");
                }}
                placeholder="ID joueur (ex : NX-A1B2C3D4)"
                maxLength={20}
              />

              <button
                className="primary-button"
                type="submit"
                disabled={searching}
              >
                {searching ? "Recherche..." : "Rechercher +"}
              </button>
            </form>

            {friendError && <p className="friend-error">{friendError}</p>}
            {friendSuccess && (
              <p className="page-description">{friendSuccess}</p>
            )}

            <div className="section-heading" style={{ marginTop: 30 }}>
              <h2>Demandes reçues ({incoming.length})</h2>
            </div>

            {loadingFriends ? (
              <p className="page-description">Chargement...</p>
            ) : incoming.length === 0 ? (
              <p className="page-description">
                Aucune demande reçue pour le moment.
              </p>
            ) : (
              <div className="friend-list">
                {incoming.map(({ request, profile: player }) => (
                  <div className="friend-row" key={request.id}>
                    <Avatar name={player.username} />

                    <div className="friend-info">
                      <strong>{player.username}</strong>
                      <span>{player.public_id}</span>
                    </div>

                    <button
                      className="primary-button"
                      disabled={acceptingId === request.id}
                      onClick={() => void acceptRequest(request.id)}
                    >
                      Accepter
                    </button>

                    <button
                      className="remove-friend"
                      onClick={() => void rejectRequest(request.id)}
                      title="Refuser"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="section-heading" style={{ marginTop: 30 }}>
              <h2>Demandes envoyées ({outgoing.length})</h2>
            </div>

            {outgoing.length === 0 ? (
              <p className="page-description">
                Aucune demande en attente.
              </p>
            ) : (
              <div className="friend-list">
                {outgoing.map(({ request, profile: player }) => (
                  <div className="friend-row" key={request.id}>
                    <Avatar name={player.username} />

                    <div className="friend-info">
                      <strong>{player.username}</strong>
                      <span>{player.public_id} · En attente</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="section-heading" style={{ marginTop: 30 }}>
              <h2>Mes amis ({friends.length})</h2>
            </div>

            {loadingFriends ? (
              <p className="page-description">Chargement des amis...</p>
            ) : friends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-symbol">♧</div>
                <h2>Aucun ami pour le moment</h2>
                <p>Recherche un joueur avec son ID NEXUSPLAY.</p>
              </div>
            ) : (
              <div className="friend-list">
                {friends.map((friend) => (
                  <div className="friend-row" key={friend.id}>
                    <Avatar
                      name={friend.username}
                      url={friend.avatarDisplay}
                    />

                    <div className="friend-info">
                      <strong>{friend.username}</strong>
                      <span>
                        <span
                          className={`online-dot ${
                            friend.online ? "" : "offline-dot"
                          }`}
                        />
                        {friend.online ? "En ligne" : "Hors ligne"} ·{" "}
                        {friend.public_id}
                      </span>
                    </div>

                    <button
                      className="primary-button"
                      onClick={() => void openChat(friend)}
                    >
                      Message
                    </button>

                    <button
                      className="remove-friend"
                      onClick={() => {
                        setSelectedFriend(friend);
                        setChatOpen(false);
                      }}
                      title="Voir le profil"
                    >
                      ◉
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedFriend && (
              <section
                className="settings-card"
                style={{
                  marginTop: 28,
                  padding: 22,
                  background:
                    styleOptions.find(
                      (style) => style.id === selectedFriend.profile_style
                    )?.background || "#171923",
                  color: "#fff",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Avatar
                    name={selectedFriend.username}
                    url={selectedFriend.avatarDisplay}
                    className="profile-big-avatar"
                  />

                  <div>
                    <h2 style={{ margin: 0 }}>
                      {selectedFriend.username}
                    </h2>
                    <p>{selectedFriend.public_id}</p>
                    <span>
                      {selectedFriend.online
                        ? "🟢 En ligne"
                        : "⚫ Hors ligne"}
                    </span>
                  </div>
                </div>

                <p>
                  {selectedFriend.bio ||
                    "Ce joueur n'a pas encore écrit de bio."}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="primary-button"
                    onClick={() => void openChat(selectedFriend)}
                  >
                    Ouvrir la conversation
                  </button>

                  <button
                    className="primary-button"
                    onClick={() => {
                      setSelectedFriend(null);
                      setChatOpen(false);
                    }}
                  >
                    Fermer le profil
                  </button>
                </div>
              </section>
            )}

            {selectedFriend && chatOpen && (
              <section
                className="settings-card"
                style={{ marginTop: 20, padding: 20 }}
              >
                <div className="section-heading">
                  <h2>
                    Conversation avec {selectedFriend.username}
                  </h2>

                  <button
                    onClick={() => {
                      setChatOpen(false);
                      setSelectedFriend(null);
                    }}
                  >
                    Fermer ×
                  </button>
                </div>

                <div
                  style={{
                    minHeight: 180,
                    maxHeight: 340,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: 12,
                    background: "rgba(0,0,0,.16)",
                    borderRadius: 10,
                  }}
                >
                  {messagesLoading ? (
                    <p>Chargement des messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="page-description">
                      Aucun message. Lance la conversation !
                    </p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        style={{
                          alignSelf:
                            message.sender_id === userId
                              ? "flex-end"
                              : "flex-start",
                          maxWidth: "80%",
                          padding: "10px 14px",
                          borderRadius: 12,
                          background:
                            message.sender_id === userId
                              ? "rgba(90,100,255,.35)"
                              : "rgba(255,255,255,.09)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {message.content}
                        </p>

                        <small style={{ opacity: 0.65 }}>
                          {new Date(message.created_at).toLocaleString(
                            "fr-FR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                          {message.sender_id === userId && message.read_at
                            ? " · Lu"
                            : ""}
                        </small>
                      </div>
                    ))
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {messageError && (
                  <p className="friend-error">{messageError}</p>
                )}

                <form
                  onSubmit={sendMessage}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <input
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Écris ton message..."
                    maxLength={2000}
                    style={{ flex: 1, minWidth: 0 }}
                  />

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={sendingMessage || !messageText.trim()}
                  >
                    {sendingMessage ? "..." : "Envoyer"}
                  </button>
                </form>
              </section>
            )}
          </div>
        )}

        {page === "settings" && (
          <div className="subpage">
            <span className="section-kicker">PERSONNALISATION</span>

            <h1>
              Mon profil<span>.</span>
            </h1>

            <div
              className="settings-card profile-settings"
              style={{
                background: currentStyle.background,
                color: currentStyle.color,
                borderRadius: 14,
                padding: 24,
              }}
            >
              <div className="profile-preview">
                <div
                  className="profile-big-avatar"
                  style={{ overflow: "hidden", padding: 0 }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Mon avatar"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    username.charAt(0).toUpperCase()
                  )}
                </div>

                <div>
                  <h2>{username}</h2>
                  <p>{session.user.email}</p>
                </div>
              </div>

              <label className="profile-field">
                <span>Ta photo de profil (5 Mo maximum)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void uploadAvatar(event)}
                />
              </label>

              {avatarPath && (
                <button
                  className="primary-button"
                  onClick={() => void removeAvatar()}
                >
                  Supprimer ma photo
                </button>
              )}

              <label className="profile-field">
                <span>Ton pseudo affiché</span>
                <input
                  value={username}
                  maxLength={24}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Entre ton pseudo"
                />
              </label>

              <label className="profile-field">
                <span>Ta bio (160 caractères maximum)</span>
                <textarea
                  value={bio}
                  maxLength={160}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Parle un peu de toi..."
                  rows={3}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </label>

              <div className="profile-field">
                <span>Style de ton profil</span>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {styleOptions.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setProfileStyle(style.id)}
                      style={{
                        background: style.background,
                        color: style.color,
                        border:
                          profileStyle === style.id
                            ? "3px solid #fff"
                            : "1px solid rgba(255,255,255,.25)",
                        borderRadius: 10,
                        padding: "12px 16px",
                        cursor: "pointer",
                      }}
                    >
                      {style.label}
                      {profileStyle === style.id ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="primary-button"
                onClick={() => void saveProfile()}
                disabled={profileSaving || profileLoading}
              >
                {profileSaving
                  ? "Enregistrement..."
                  : "Enregistrer mon profil"}
              </button>

              {profileError && (
                <p className="friend-error">{profileError}</p>
              )}

              {profileSuccess && (
                <p className="page-description">{profileSuccess}</p>
              )}

              <div className="setting-row">
                <span>Compte</span>
                <strong>Connecté</strong>
              </div>

              <div className="setting-row">
                <span>Mon ID joueur</span>
                <strong>
                  {profileLoading ? "Chargement..." : publicId}
                </strong>
              </div>

              <button
                className="primary-button"
                onClick={() => void copyPlayerId()}
                disabled={!publicId.startsWith("NX-")}
              >
                Copier mon ID joueur
              </button>

              {copyMessage && (
                <p className="page-description">{copyMessage}</p>
              )}

              <div className="setting-row">
                <span>Amis</span>
                <strong>{friends.length}</strong>
              </div>

              <div className="setting-row">
                <span>Version</span>
                <strong>0.1.0</strong>
              </div>

              {logoutError && (
                <p className="friend-error">{logoutError}</p>
              )}

              <button
                className="primary-button"
                onClick={() => void handleLogout()}
              >
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="right-sidebar">
        <button
          className="profile-circle"
          onClick={() => setPage("settings")}
          title={`Profil de ${username}`}
          style={{ overflow: "hidden", padding: 0 }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Mon profil"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            username.charAt(0).toUpperCase()
          )}
        </button>

        <div className="friends-heading">
          <span className="online-dot" />
          AMIS
        </div>

        {friends.slice(0, 6).map((friend) => (
          <button
            className="friend-entry"
            key={friend.id}
            onClick={() => {
              setPage("friends");
              setSelectedFriend(friend);
              setChatOpen(false);
            }}
            title={friend.username}
          >
            <Avatar
              name={friend.username}
              url={friend.avatarDisplay}
            />

            <span
              className={`friend-online ${
                friend.online ? "" : "friend-offline"
              }`}
            />
          </button>
        ))}

        <div className="right-divider" />

        <button
          className="community-button"
          onClick={() => setPage("friends")}
          title="Gérer mes amis"
        >
          +
        </button>

        <span className="friends-count">AMIS</span>
      </aside>
    </main>
  );
}

export default App;