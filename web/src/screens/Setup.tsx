import { useState, type FormEvent } from "react";
import { DEPARTMENTS, YEARS, type Department, type Year } from "@shared/types";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Setup() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [dept, setDept] = useState<Department | "">("");
  const [year, setYear] = useState<Year | "">("");
  const [roll, setRoll] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter your name.");
    if (!dept) return setError("Pick your department.");
    if (!year) return setError("Pick your year.");
    if (!roll.trim()) return setError("Enter your roll number.");

    setBusy(true);
    setError("");
    try {
      await api.completeProfile({ name: name.trim(), dept, year, roll: roll.trim().toUpperCase() });
      // The live user doc flips profileDone and the route guard sends us to /home.
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <h1>Set up your profile</h1>
      <p className="muted">One time only. Your roll number is checked when you collect prizes.</p>

      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          Full name
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>

        <label className="field">
          Department
          <select value={dept} onChange={(e) => setDept(e.target.value as Department)}>
            <option value="" disabled>
              Choose…
            </option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value) as Year)}>
            <option value="" disabled>
              Choose…
            </option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Roll number
          <input
            value={roll}
            onChange={(e) => setRoll(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            placeholder="e.g. 22EJCCS001"
          />
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
