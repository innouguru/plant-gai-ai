import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchFarmMembers } from "../../api/farms";
import { createInvitation } from "../../api/invitations";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/FormField";
import Modal from "../../components/ui/Modal";
import Avatar from "../../components/ui/Avatar";
import StatusBadge from "../../components/ui/StatusBadge";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { devFarmMembers } from "../../data/devMocks";

function FarmersPage() {
  const { profile, session } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();
  const isPreview = previewRole === "farm_admin";
  const farmId = profile?.farmId;

  const [members, setMembers] = useState(isPreview ? devFarmMembers : []);
  const [loadingMembers, setLoadingMembers] = useState(isPreview ? false : true);
  const [membersError, setMembersError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  useEffect(() => {
    if (isPreview || !farmId || !session) return;

    let active = true;
    setLoadingMembers(true);
    setMembersError(null);

    fetchFarmMembers(farmId, session.access_token)
      .then((data) => {
        if (active) setMembers(data);
      })
      .catch((err) => {
        if (active) setMembersError(err?.message ?? "Could not load farm members.");
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });

    return () => {
      active = false;
    };
  }, [farmId, session, isPreview]);

  async function handleInvite(event) {
    event.preventDefault();
    if (isPreview) return;

    setInviteError(null);
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
      setModalOpen(false);
    } catch (err) {
      setInviteError(err?.message ?? "We could not send the invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isPreview && !farmId) {
    return null;
  }

  const farmName = isPreview
    ? previewProfile?.farm?.name ?? "Green Valley Farm"
    : profile?.farm?.name;

  return (
    <div aria-label="Farmers">
      <PageHeader
        title="Farmers"
        subtitle={`Invite farmers to join ${farmName ?? "your farm"}.`}
        actions={
          isPreview ? (
            <p className="form-message">Invites are disabled in the UI preview.</p>
          ) : (
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <span>Invite New Farmer</span>
            </Button>
          )
        }
      />

      {inviteSuccess && (
        <p className="form-success form-message" role="status">
          {inviteSuccess}
        </p>
      )}

      {loadingMembers ? (
        <LoadingState message="Loading members..." />
      ) : membersError ? (
        <ErrorState message={membersError} onRetry={() => window.location.reload()} />
      ) : members.length === 0 ? (
        <EmptyState title="No farmers yet" message="Invite your first farmer to get started." />
      ) : (
        <div className="farmer-list">
          {members.map((member) => (
            <div key={member.id} className="farmer-row">
              <Avatar name={member.full_name || member.email} />
              <div className="farmer-row-main">
                <p className="farmer-row-name">{member.full_name || member.email}</p>
                <p className="farmer-row-email">{member.email}</p>
              </div>
              <StatusBadge status={member.role === "farm_admin" ? "alert" : "healthy"} className="badge-role">
                {member.role === "farm_admin" ? "Farm Admin" : "Farmer"}
              </StatusBadge>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title="Invite a farmer" onClose={() => setModalOpen(false)}>
        <p className="auth-subtitle">
          They will receive an email to finish creating their account.
        </p>
        <form onSubmit={handleInvite}>
          <FormField id="inviteEmail" label="Email">
            <input
              id="inviteEmail"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>

          <FormField id="inviteName" label="Full name (optional)">
            <input
              id="inviteName"
              type="text"
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </FormField>

          {inviteError && (
            <p className="form-error form-message" role="alert">
              {inviteError}
            </p>
          )}

          <Button type="submit" variant="primary" block disabled={submitting}>
            {submitting ? "Sending..." : "Send Invitation"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

export default FarmersPage;