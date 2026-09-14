import { useState } from "react";
import FormField from "./FormField";

function PasswordField({ id, label, hint, className = "", value, onChange, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} hint={hint} className={className}>
      <span className="password-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          {...inputProps}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide password" : "Show password"}
        </button>
      </span>
    </FormField>
  );
}

export default PasswordField;