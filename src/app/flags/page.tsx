"use client";

import { PageHeader } from "@/components/app/PageHeader";
import { FlagsSuggestions } from "@/components/flags/FlagsSuggestions";

export default function FlagsPage() {
  return (
    <div>
      <PageHeader title="Flags & Suggestions" />
      <FlagsSuggestions />
    </div>
  );
}
