import React from "react";

const Avatar = React.memo(function Avatar({ name, size = "" }) {
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={["avatar", size ? `avatar-${size}` : ""].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
});

export default Avatar;