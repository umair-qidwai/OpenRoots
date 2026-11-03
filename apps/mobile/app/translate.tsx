import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Research } from "../src/components/Research";
export default function Translate() {
  const { entry, passage } = useLocalSearchParams<{
    entry?: string;
    passage?: string;
  }>();
  return <Research task="translate" entryId={entry} passageId={passage} />;
}
