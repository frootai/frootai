interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
}

export default function SearchInput({ value, onChange, placeholder, resultCount }: SearchInputProps) {
  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <input
        className="input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search..."}
        style={{ paddingLeft: 32, paddingRight: value ? 110 : 70 }}
      />
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6 }}>
        {resultCount !== undefined && (
          <span style={{ opacity: 0.5, fontSize: 11 }}>
            {resultCount} results
          </span>
        )}
        {value && (
          <button
            onClick={() => onChange("")}
            style={{
              background: "var(--vscode-button-secondaryBackground, #333)",
              color: "var(--vscode-button-secondaryForeground, #ccc)",
              border: "none",
              borderRadius: 3,
              padding: "2px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </span>
    </div>
  );
}
