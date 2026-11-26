'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  Copy,
  Mail,
  LoaderCircle,
  CircleAlert,
  CircleCheck,
  Search,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Workspace } from './workspace';
import { roles, type Role } from '@/lib/roles';
export function TokenCopy() {
  const [status, setStatus] = useState('Copy CSS tokens');
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        ':root { --background: #080816; --surface: #151329; --primary: #A855F7; --secondary: #FF647C; --highlight: #FF965C; --foreground: #F8F7FF; }',
      );
      setStatus('Copied to clipboard');
    } catch {
      setStatus('Copy unavailable in this browser');
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      <Copy size={14} />
      <span aria-live="polite">{status}</span>
    </Button>
  );
}
export function WorkspaceShowcase() {
  const [role, setRole] = useState<Role>('STUDENT');
  const reduced = useReducedMotion();
  return (
    <>
      <div className="workspace-tabs" aria-label="Workspace previews">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => setRole(r)}
          >
            {r.charAt(0) + r.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={role}
          initial={{ y: reduced ? 0 : 3 }}
          animate={{ y: 0 }}
          exit={{ y: reduced ? 0 : -3 }}
          transition={{ duration: reduced ? 0 : 0.12 }}
        >
          <Workspace role={role} preview />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
export function FormDemo() {
  const [success, setSuccess] = useState(false);
  return (
    <form
      className="demo-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSuccess(true);
      }}
    >
      <label htmlFor="demo-email">
        Email address <span className="muted">(component demo)</span>
      </label>
      <div className="input-with-icon">
        <Mail size={17} />
        <Input
          id="demo-email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="off"
          aria-describedby="email-help"
          onChange={() => setSuccess(false)}
        />
      </div>
      <p id="email-help" className="field-help">
        Local validation only. Nothing is sent or stored.
      </p>
      <Button variant="secondary" type="submit">
        Validate example
      </Button>
      <p className="form-result" role="status">
        {success && (
          <>
            <Check size={16} />
            Valid email format. Demo complete.
          </>
        )}
      </p>
    </form>
  );
}
export function StateExamples() {
  return (
    <div className="state-grid">
      <div className="state-example">
        <LoaderCircle className="loading-icon" size={20} />
        <h3>Loading</h3>
        <div className="skeleton" />
        <div className="skeleton short" />
        <p>Getting things ready…</p>
      </div>
      <div className="state-example">
        <Search size={20} />
        <h3>Empty</h3>
        <p>No projects yet. Your first build starts a new chapter.</p>
      </div>
      <div className="state-example">
        <CircleAlert className="coral-text" size={20} />
        <h3>Something went wrong</h3>
        <p>We couldn’t load this section. Please try again.</p>
      </div>
      <div className="state-example">
        <CircleCheck className="green-text" size={20} />
        <h3>You’re all set</h3>
        <p>Your changes have been saved. Keep moving forward.</p>
      </div>
    </div>
  );
}
