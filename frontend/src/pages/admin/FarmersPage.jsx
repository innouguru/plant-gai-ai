import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { fetchFarmMembers } from "../../api/farms";
import { createInvitation } from "../../api/invitations";

function FarmersPage() {
  const { profile, session } = useAuth();
  const farmId = profile?.farmId;

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  useEffect(() => {
    if (!farmId) return;

    let active = true;
    setLoadingMembers(true);
    setMembersError(null);

    fetchFarmMembers(farmId, session.access_token)
      .then((data) => {
        if (active) {
          setMembers(data);
        }
      })
      .catch((err) => {
        if (active) {
          setMembersError(err?.message ?? "Could not load farm members.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingMembers(false);
        }
      });

    return () => {
      active = false;
    };
  }, [farmId, session]);

  async function handleInvite(event) {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setSubmitting(true);

    try {
      await createInvitation(
        email,
        fullName.trim() ? fullName.trim() : null,
        session.access_token,
      );
      setInviteSuccess(
        "Invitation sent. The farmer will receive an email to complete their registration.",
      );
      setEmail("");
      setFullName("");
    } catch (err) {
      setInviteError(err?.message ?? "We could not send the invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!farmId) {
    return null;
  }

  return (
    <section className="dashboard" aria-label="Farmers">
      <h2>Farmers</h2>
      <p className="dashboard-hint">Invite farmers to join {profile?.farm?.name ?? "your farm"}.</p>

      <div className="card">
        <h3>Invite a farmer</h3>
        <form className="auth-form" onSubmit={handleInvite}>
          <label htmlFor="inviteEmail">Email</label>
          <input
            id="inviteEmail"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="inviteName">Full name (optional)</label>
          <input
            id="inviteName"
            type="text"
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          {inviteError && (
            <p className="form-error" role="alert">
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p className="form-success" role="status">
              {inviteSuccess}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send invitation"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Members</h3>
        {loadingMembers ? (
          <p className="status-loading">Loading members...</p>
        ) : membersError ? (
          <p className="form-error">{membersError}</p>
        ) : members.length === 0 ? (
          <p className="dashboard-hint">No farmers on this farm yet.</p>
        ) : (
          <ul className="member-list">
            {members.map((member) => (
              <li key={member.id} className="member-row">
                <span className="member-name">{member.full_name || member.email}</span>
                <span className="member-role">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default FarmersPage;