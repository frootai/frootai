"use client";

import { useState, useEffect, useCallback } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search primitives, plays, modules...",
}: SearchBarProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const debounce = useCallback(
    (val: string) => {
      const timer = setTimeout(() => onChange(val), 300);
      return () => clearTimeout(timer);
    },
    [onChange]
  );

  useEffect(() => {
    const cleanup = debounce(local);
    return cleanup;
  }, [local, debounce]);

  return (
    <div className="relative w-full max-w-xl">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-frootai-muted text-sm">
        🔍
      </span>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-frootai-border bg-frootai-surface px-10 py-2.5 text-sm text-frootai-text placeholder:text-frootai-muted focus:border-frootai-emerald focus:outline-none focus:ring-1 focus:ring-frootai-emerald transition-colors"
      />
      {local && (
        <button
          onClick={() => {
            setLocal("");
            onChange("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-frootai-muted hover:text-frootai-text text-sm"
        >
          ✕
        </button>
      )}
    </div>
  );
}
