import { useState, type FormEvent } from "react";
import { NAME_MAX, NAME_MIN } from "@shared/types";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

/** Name only (SPEC §4); the email comes from the login. */
export default function Setup() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      return setError(`Enter your name (${NAME_MIN}–${NAME_MAX} characters).`);
    }
    setBusy(true);
    setError("");
    try {
      await api.completeProfile({ name: trimmed });
      // The live user doc flips profileDone and the route guard sends us to /home.
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <h1>Set up your profile</h1>
      <p className="muted">Use the name on your college ID card — prizes are only handed over if it matches.</p>

      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          Full name
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} />
        </label>

        <label className="field">
          Email
          <input value={user?.email ?? ""} readOnly aria-readonly="true" className="readonly" />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Start hunting"}
        </button>
      </form>

      <button className="btn link" onClick={signOut} style={{ marginTop: 8 }}>
        Not you? Log out
      </button>
    </main>
  );
}
