import { useState } from "react";
import Placeholder from "../components/Placeholder";

export default function Leaderboard() {
  const [tab, setTab] = useState<"students" | "depts">("students");
  return (
    <main className="screen with-nav stack">
      <h1>Leaderboard</h1>
      <div className="row" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "students"}
          className={`btn ${tab === "students" ? "" : "secondary"}`}
          onClick={() => setTab("students")}
        >
          Students
        </button>
        <button
          role="tab"
          aria-selected={tab === "depts"}
          className={`btn ${tab === "depts" ? "" : "secondary"}`}
          onClick={() => setTab("depts")}
        >
          Departments
        </button>
      </div>
      <Placeholder day={5}>{tab === "students" ? "Top 100 students, your rank pinned" : "Department totals"}</Placeholder>
    </main>
  );
}
