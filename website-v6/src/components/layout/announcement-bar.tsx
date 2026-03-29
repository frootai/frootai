"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sprout, ArrowRight } from "lucide-react";

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="relative z-[60] border-b border-border-subtle bg-bg-surface/80 backdrop-blur-lg"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2 text-[11px] sm:text-[12px]">
          <p className="flex-1 flex items-center justify-center gap-1.5 text-fg-muted">
            <Sprout className="h-3.5 w-3.5 text-fg-muted shrink-0" />
            <span className="text-center">
              <strong className="text-fg">FrootAI</strong>
              <span> — Ampli</span><span className="font-bold text-white">F</span><span className="font-bold text-emerald">AI</span><span> your Agentic Ecosystem</span>
              {" "}
              <Link
                href="/setup-guide"
                className="nav-accent-amber inline-flex items-center gap-1 rounded-full border border-fg-dim/20 bg-bg-elevated/60 px-2.5 py-0.5 text-fg font-semibold transition-all duration-200 ml-1"
              >
                Get Started <ArrowRight className="h-3 w-3" />
              </Link>
            </span>
          </p>
          <button
            onClick={() => setVisible(false)}
            className="shrink-0 p-1 text-fg-dim hover:text-fg transition-colors cursor-pointer rounded-md hover:bg-bg-hover"
            aria-label="Close announcement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
