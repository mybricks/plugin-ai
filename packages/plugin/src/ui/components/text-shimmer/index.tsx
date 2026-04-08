import React from "react";
import css from "./index.less";

interface TextShimmerProps {
  children: string;
  className?: string;
}

const TextShimmer = ({ children, className }: TextShimmerProps) => (
  <span className={`${css["text-shimmer"]} ${className ?? ""}`}>{children}</span>
);

export { TextShimmer };
